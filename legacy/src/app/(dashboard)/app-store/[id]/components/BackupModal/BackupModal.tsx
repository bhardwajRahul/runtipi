import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import type { AppInfo } from '@runtipi/shared';
import { useTranslations } from 'next-intl';
import type React from 'react';

interface IProps {
  info: AppInfo;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const BackupModal: React.FC<IProps> = ({ info, isOpen, onClose, onConfirm }) => {
  const t = useTranslations();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('APP_BACKUP_TITLE', { name: info.name })}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <span className="text-muted">{t('APP_BACKUP_SUBTITLE')}</span>
        </DialogDescription>
        <DialogFooter>
          <Button onClick={onConfirm} intent="success">
            {t('APP_BACKUP_SUBMIT')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
