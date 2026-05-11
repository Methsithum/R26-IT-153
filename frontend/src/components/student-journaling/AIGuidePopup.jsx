import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionOptions from './QuestionOptions';

export default function AIGuidePopup({ visible, mission, onComplete, onClose }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [answers, setAnswers] = useState([]);
  const typingRef = useRef(null);

  const dialogue = mission ? buildDialogue(mission) : [];
  const current = dialogue[step];

  useEffect(() => {
    if (visible && current) {
      setSelected(null);
      setDisplayedText('');
      setIsTyping(true);
      let i = 0;
      const msg = current.message;
      clearInterval(typingRef.current);
      typingRef.current = setInterval(() => {
        i++;
        setDisplayedText(msg.slice(0, i));
        if (i >= msg.length) {
          clearInterval(typingRef.current);
          setIsTyping(false);
        }
      }, 22);
    }
    return () => clearInterval(typingRef.current);
  }, [step, visible, mission]);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setAnswers([]);
    }
  }, [visible, mission]);

  const handleNext = () => {
    if (selected === null) return;
    const newAnswers = [...answers, { question: current.message, answer: current.options[selected].text }];
    setAnswers(newAnswers);
    if (step < dialogue.length - 1) {
      setStep(s => s + 1);
      setSelected(null);
    } else {
      onComplete && onComplete(newAnswers);
    }
  };

  const skipTyping = () => {
    clearInterval(typingRef.current);
    setDisplayedText(current?.message || '');
    setIsTyping(false);
  };

  if (!visible || !current) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-end justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose && onClose()}
      >
        <motion.div
          className="w-full max-w-md rounded-3xl border p-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #0f1128, #13162e)',
            borderColor: 'rgba(124,58,237,0.45)',
            boxShadow: '0 0 60px rgba(124,58,237,0.25), 0 30px 80px rgba(0,0,0,0.7)',
          }}
          initial={{ y: 80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        >
          {/* glow ring */}
          <motion.div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ border: '1px solid rgba(124,58,237,0.2)' }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <motion.div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border"
                style={{ flexShrink: 0 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(79,70,229,0.4))',
                  borderColor: 'rgba(167,139,250,0.35)',
                }}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                🤖
              </motion.div>
              <motion.div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{ background: '#22c55e', borderColor: '#0f1128' }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-violet-300">NOVA</p>
              <p className="text-xs text-slate-500">Academic Mission Guide</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 font-mono">{step + 1}/{dialogue.length}</span>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center border text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 mb-5">
            {dialogue.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-0.5 rounded-full transition-all duration-500"
                style={{
                  background: i < step ? '#7c3aed' : i === step ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)',
                }}
              />
            ))}
          </div>

          {/* Message bubble */}
          <motion.div
            key={step}
            className="mb-5 min-h-15"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p
              className="text-sm text-slate-200 leading-relaxed cursor-pointer"
              onClick={isTyping ? skipTyping : undefined}
            >
              {displayedText}
              {isTyping && (
                <motion.span
                  className="inline-block w-0.5 h-3.5 bg-violet-400 ml-0.5 align-middle"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                />
              )}
            </p>
            {isTyping && (
              <p className="text-[10px] text-slate-600 mt-1">Tap message to skip</p>
            )}
          </motion.div>

          {/* Options */}
          <AnimatePresence>
            {!isTyping && (
              <motion.div
                key={`opts-${step}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <QuestionOptions
                  options={current.options}
                  selected={selected}
                  onSelect={setSelected}
                />

                <motion.button
                  className="w-full mt-4 py-3.5 rounded-xl text-sm font-semibold border transition-all"
                  style={{
                    background: selected !== null
                      ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                      : 'rgba(255,255,255,0.04)',
                    borderColor: selected !== null ? 'transparent' : 'rgba(255,255,255,0.08)',
                    color: selected !== null ? '#fff' : '#334155',
                    cursor: selected !== null ? 'pointer' : 'not-allowed',
                  }}
                  whileHover={selected !== null ? { scale: 1.01 } : {}}
                  whileTap={selected !== null ? { scale: 0.98 } : {}}
                  onClick={handleNext}
                >
                  {step < dialogue.length - 1 ? 'Continue →' : '✨ Complete Mission'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function buildDialogue(mission) {
  const base = {
    'assignment': [
      {
        message: `Hey! 👋 Looks like you worked on your ${mission.name} today. How far did you progress?`,
        options: [
          { text: 'Just getting started' },
          { text: 'In progress — halfway there' },
          { text: 'Almost done, final touches' },
          { text: 'Fully completed ✓' },
        ],
      },
      {
        message: 'Good work! Did you run into any blockers or challenges?',
        options: [
          { text: 'No blockers at all' },
          { text: 'Minor issues, sorted now' },
          { text: 'Stuck on a concept' },
          { text: 'Needed help from someone' },
        ],
      },
      {
        message: 'How confident are you about the quality of your work so far?',
        options: [
          { text: 'Needs revision' },
          { text: 'Satisfactory' },
          { text: 'Pretty solid' },
          { text: 'Excellent — proud of it!' },
        ],
      },
      {
        message: 'Last one! Did you set a clear target for your next session?',
        options: [
          { text: 'Not yet' },
          { text: 'Roughly, yes' },
          { text: 'Yes, clear plan' },
          { text: 'Already done!' },
        ],
      },
    ],
    'project': [
      {
        message: `Great — let's log your project session! Which phase did you focus on for ${mission.name}?`,
        options: [
          { text: 'Planning & design' },
          { text: 'Development / coding' },
          { text: 'Testing & debugging' },
          { text: 'Documentation' },
        ],
      },
      {
        message: 'How many focused hours did you put in today?',
        options: [
          { text: 'Less than 1 hour' },
          { text: '1–2 hours' },
          { text: '2–4 hours' },
          { text: 'More than 4 hours' },
        ],
      },
      {
        message: 'Did you hit any of your planned milestones for today?',
        options: [
          { text: 'No milestones reached' },
          { text: 'Partially achieved' },
          { text: 'Met my goals' },
          { text: 'Exceeded expectations!' },
        ],
      },
    ],
    'revision': [
      {
        message: `Nice! Revision mode activated 📚 What subject did you revise for ${mission.name}?`,
        options: [
          { text: 'Went through lecture notes' },
          { text: 'Watched recorded lectures' },
          { text: 'Solved past papers' },
          { text: 'Group study session' },
        ],
      },
      {
        message: 'How well did you grasp the concepts you revised today?',
        options: [
          { text: 'Still confused' },
          { text: 'Getting clearer' },
          { text: 'Mostly understood' },
          { text: 'Fully confident now' },
        ],
      },
      {
        message: 'Did you make notes or summaries during your revision?',
        options: [
          { text: 'No, just read through' },
          { text: 'A few quick notes' },
          { text: 'Detailed notes made' },
          { text: 'Full mind map created' },
        ],
      },
    ],
  };

  return base[mission.type] || base['assignment'];
}
