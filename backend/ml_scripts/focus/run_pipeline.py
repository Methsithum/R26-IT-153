#!/usr/bin/env python3
"""Run the 4-class feature pipeline: convert datasets -> merge -> train model."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.resolve()


def run(script):
    path = ROOT / script
    print(f"\n>>> Running: {path}\n")
    result = subprocess.run([sys.executable, str(path)], cwd=str(ROOT))
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main():
    run('convert_eye_dataset.py')
    run('convert_fatigue_dataset.py')
    run('convert_facial_dataset.py')
    run('convert_boredom_dataset.py')
    run('merge_all_datasets.py')
    run('train_xgboost.py')


if __name__ == '__main__':
    main()
