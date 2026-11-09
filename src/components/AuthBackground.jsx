import React from 'react';
import { motion } from 'framer-motion';

export default function AuthBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-gradient-to-br from-sky-50 via-background to-cyan-50 dark:from-slate-900 dark:via-background dark:to-slate-900">
      <motion.div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-300/30 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-cyan-300/25 blur-3xl"
        animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 w-72 h-72 rounded-full bg-teal-300/20 blur-3xl"
        animate={{ x: [0, 20, 0], y: [0, -25, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}