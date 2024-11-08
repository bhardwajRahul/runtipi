import { deleteLinkAction } from '@/actions/custom-links/delete-link-action';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader } from '@/components/ui/Dialog';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useRouter } from 'next/navigation';
import type React from 'react';
import toast from 'react-hot-toast';

type DeleteLinkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  linkId: number;
  linkTitle: string;
};

export const DeleteLinkModal: React.FC<DeleteLinkModalProps> = ({ isOpen, onClose, linkTitle, linkId }) => {
  const t = useTranslations();
  const router = useRouter();

  const deleteLinkMutation = useAction(deleteLinkAction, {
    onError: ({ error }) => {
      if (error.serverError) toast.error(error.serverError);
    },
    onSuccess: () => {
      router.refresh();
      onClose();
      toast.success(t('LINKS_DELETE_SUCCESS'));
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <h5 className="modal-title">
            {t('LINKS_DELETE_TITLE')} {linkTitle}?
          </h5>
        </DialogHeader>
        <DialogDescription>
          <div className="text-muted">{t('LINKS_DELETE_SUBTITLE')}</div>
        </DialogDescription>
        <DialogFooter>
          <Button intent="danger" onClick={() => deleteLinkMutation.execute(linkId)}>
            {t('LINKS_DELETE_SUBMIT')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
