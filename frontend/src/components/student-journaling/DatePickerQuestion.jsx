import { useState } from 'react';
import { motion } from 'framer-motion';

export default function DatePickerQuestion({ onSelect, onCancel }) {
  const [selectedDate, setSelectedDate] = useState('');

  const handleConfirm = () => {
    if (selectedDate) {
      onSelect(new Date(selectedDate));
    }
  };

  // Get minimum date (today)
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];

  return (
    <motion.div 
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        <label className="text-xs font-semibold text-slate-400 mb-2 block">Select Deadline</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={minDate}
          className="w-full px-4 py-3 rounded-xl border bg-slate-900/50 text-slate-200 border-violet-500/40 focus:border-violet-500/80 focus:outline-none font-medium"
        />
      </div>
      
      <div className="flex gap-2">
        <motion.button
          onClick={handleConfirm}
          disabled={!selectedDate}
          className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
          style={{
            background: selectedDate ? 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(79,70,229,0.8))' : 'rgba(124,58,237,0.2)',
            color: selectedDate ? '#e0e7ff' : '#94a3b8',
            cursor: selectedDate ? 'pointer' : 'not-allowed',
          }}
          whileHover={selectedDate ? { scale: 1.02 } : {}}
          whileTap={selectedDate ? { scale: 0.98 } : {}}
        >
          {selectedDate ? `Set Deadline (${new Date(selectedDate).toLocaleDateString()})` : 'Pick a Date'}
        </motion.button>
        
        <motion.button
          onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-xl font-medium border transition-all"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            color: '#cbd5e1',
            background: 'rgba(255,255,255,0.02)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Skip for Now
        </motion.button>
      </div>
    </motion.div>
  );
}
