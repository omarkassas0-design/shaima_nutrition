import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Archive, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ClinicCard from './ClinicCard';

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' } }) };

export default function RecycleBinDialog({ open, onOpenChange, deletedClinics, onManage, isLoading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-primary" />
            Recycle Bin
          </DialogTitle>
          <DialogDescription>
            Soft-deleted clinics — restore to reactivate or permanently delete to destroy all data.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array(2).fill(0).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-secondary/40 animate-pulse" />
            ))}
          </div>
        ) : deletedClinics.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-10 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No deleted clinics in the recycle bin.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deletedClinics.map((clinic, i) => (
              <motion.div key={clinic.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
                <ClinicCard clinic={clinic} onManage={onManage} />
              </motion.div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}