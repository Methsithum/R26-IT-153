"""
Hand-rolled in-memory fake for the subset of PyMongo collection operations
this project's models actually use, plus a "guard" collection that makes any
UNPATCHED real collection raise loudly instead of silently touching a real
database. No new package (e.g. mongomock) is introduced.

FakeCollection supports: find_one, find (chainable .sort()/.limit()),
insert_one, insert_many, update_one, update_many, replace_one, delete_one,
delete_many, count_documents, find_one_and_update, create_index (no-op).
aggregate() is NOT supported (raises NotImplementedError) - nothing this
task's code path uses needs it.

Query matcher supports: exact-value equality, dict/ObjectId/str comparison,
$or (list of sub-queries, any match), $in / $nin (membership), $exists
(presence/absence), and a bare None value matching "field is None or absent"
(the shape ExamModel/TaskModel's _blank_field_query-style queries use).
It does NOT support $gte/$lte/$gt/$lt range queries, regex queries, or
dot-notation nested-field queries - none of the code paths exercised by
these tests use them, but a future test that does would need the matcher
extended first (see the divergence list in the report for this task).

KNOWN DIVERGENCES FROM REAL MONGODB (documented per review requirement):
- Upsert semantics: FakeCollection has no native upsert=True support on
  update_one/update_many; AssessmentPredictionModel.upsert() does its own
  find-then-update-or-insert (already true against real Mongo too - it
  doesn't rely on $set upsert=True), so this is not exercised here.
- Sort stability: Python's list.sort() is stable, matching MongoDB's
  documented behavior for ties on the sort key when an insertion-order
  tiebreaker existed already, but MongoDB does NOT itself guarantee stable
  sort ordering for ties on a single sort key in the general case - the
  fake is arguably MORE deterministic than real Mongo here.
- ObjectId handling: the fake stores whatever object is passed as _id
  (usually a real bson.ObjectId, since tests construct one explicitly) and
  compares with plain ==, which works correctly for ObjectId equality but
  does not replicate MongoDB's BSON type-coercion edge cases (e.g. matching
  an ObjectId against its hex string) - callers must pass the same type
  consistently, which the code under test already does.
- No write-concern, no transactions, no server-side query planning/indexes
  (create_index is a no-op).
"""

from copy import deepcopy

from bson import ObjectId


class _RealDbAccessGuard:
    """Any call to any of these raises - stands in for every collection this test module didn't explicitly fake."""

    _GUARDED_METHODS = (
        "find", "find_one", "insert_one", "insert_many", "update_one", "update_many",
        "replace_one", "delete_one", "delete_many", "count_documents", "aggregate",
        "find_one_and_update", "create_index",
    )

    def __getattr__(self, name):
        if name in self._GUARDED_METHODS:
            def _raise(*args, **kwargs):
                raise RuntimeError("real DB access attempted in test")
            return _raise
        raise AttributeError(name)


def _matches(doc: dict, query: dict) -> bool:
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(doc, sub) for sub in expected):
                return False
            continue
        actual = doc.get(key)
        if isinstance(expected, dict) and any(k.startswith("$") for k in expected):
            for op, val in expected.items():
                if op == "$in":
                    if actual not in val:
                        return False
                elif op == "$nin":
                    if actual in val:
                        return False
                elif op == "$exists":
                    present = key in doc
                    if present != val:
                        return False
                else:
                    raise NotImplementedError(f"FakeCollection matcher does not support operator {op!r}")
            continue
        if expected is None:
            if actual is not None:
                return False
            continue
        if actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, docs: list[dict]):
        self._docs = list(docs)

    def sort(self, spec):
        if isinstance(spec, str):
            spec = [(spec, 1)]
        for key, direction in reversed(spec):
            self._docs.sort(key=lambda d: (d.get(key) is None, d.get(key)), reverse=(direction < 0))
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    def skip(self, n):
        self._docs = self._docs[n:]
        return self

    def __iter__(self):
        return iter(deepcopy(self._docs))

    def __list__(self):
        return list(self)


class FakeCollection:
    def __init__(self, initial_docs: list[dict] | None = None):
        self._docs: list[dict] = [deepcopy(d) for d in (initial_docs or [])]

    def find_one(self, query: dict | None = None, sort=None):
        query = query or {}
        matches = [d for d in self._docs if _matches(d, query)]
        if sort:
            matches = list(FakeCursor(matches).sort(sort))
        return deepcopy(matches[0]) if matches else None

    def find(self, query: dict | None = None, projection: dict | None = None):
        query = query or {}
        matches = [d for d in self._docs if _matches(d, query)]
        return FakeCursor(matches)

    def insert_one(self, doc: dict):
        # Real PyMongo auto-generates and assigns _id (mutating the passed
        # dict in place) when the caller doesn't supply one - replicate that,
        # since app code (e.g. AssessmentPredictionModel.upsert) relies on
        # reading doc["_id"] back immediately after insert_one().
        if "_id" not in doc:
            doc["_id"] = ObjectId()
        self._docs.append(deepcopy(doc))
        return type("Result", (), {"inserted_id": doc["_id"]})()

    def insert_many(self, docs: list[dict]):
        for d in docs:
            if "_id" not in d:
                d["_id"] = ObjectId()
            self._docs.append(deepcopy(d))
        return type("Result", (), {"inserted_ids": [d["_id"] for d in docs]})()

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        for d in self._docs:
            if _matches(d, query):
                self._apply_update(d, update)
                return type("Result", (), {"matched_count": 1, "modified_count": 1})()
        if upsert:
            new_doc = {k: v for k, v in query.items() if not k.startswith("$")}
            self._apply_update(new_doc, update)
            self._docs.append(new_doc)
            return type("Result", (), {"matched_count": 0, "modified_count": 0, "upserted_id": new_doc.get("_id")})()
        return type("Result", (), {"matched_count": 0, "modified_count": 0})()

    def update_many(self, query: dict, update: dict):
        count = 0
        for d in self._docs:
            if _matches(d, query):
                self._apply_update(d, update)
                count += 1
        return type("Result", (), {"matched_count": count, "modified_count": count})()

    def replace_one(self, query: dict, doc: dict, upsert: bool = False):
        for i, d in enumerate(self._docs):
            if _matches(d, query):
                self._docs[i] = deepcopy(doc)
                return type("Result", (), {"matched_count": 1, "modified_count": 1})()
        if upsert:
            self._docs.append(deepcopy(doc))
        return type("Result", (), {"matched_count": 0, "modified_count": 0})()

    def delete_one(self, query: dict):
        for i, d in enumerate(self._docs):
            if _matches(d, query):
                del self._docs[i]
                return type("Result", (), {"deleted_count": 1})()
        return type("Result", (), {"deleted_count": 0})()

    def delete_many(self, query: dict):
        before = len(self._docs)
        self._docs = [d for d in self._docs if not _matches(d, query)]
        return type("Result", (), {"deleted_count": before - len(self._docs)})()

    def count_documents(self, query: dict):
        return sum(1 for d in self._docs if _matches(d, query))

    def find_one_and_update(self, query: dict, update: dict, return_document=None):
        for d in self._docs:
            if _matches(d, query):
                before = deepcopy(d)
                self._apply_update(d, update)
                return deepcopy(d) if return_document else before
        return None

    def create_index(self, *args, **kwargs):
        return "fake_index"

    def aggregate(self, pipeline):
        raise NotImplementedError("FakeCollection does not support aggregate()")

    @staticmethod
    def _apply_update(doc: dict, update: dict):
        if "$set" in update:
            doc.update(update["$set"])
        if "$inc" in update:
            for k, v in update["$inc"].items():
                doc[k] = doc.get(k, 0) + v
        if "$unset" in update:
            for k in update["$unset"]:
                doc.pop(k, None)
        non_operator_keys = {k: v for k, v in update.items() if not k.startswith("$")}
        if non_operator_keys and not any(k.startswith("$") for k in update):
            doc.clear()
            doc.update(non_operator_keys)
