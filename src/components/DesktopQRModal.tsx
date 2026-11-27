import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Ruler, Smartphone, X } from 'lucide-react';
import type { MenuItem } from '../types/menu';
import { getDishDeepLinkUrl } from '../utils/device';

interface DesktopQRModalProps {
  item: MenuItem | null;
  customUrl?: string;
  customTitle?: string;
  customSubtitle?: string;
  onClose: () => void;
}

/**
 * Refined dark-glass Desktop AR Handoff Modal with dynamically generated QR code
 * linking directly to a single dish or full Table Spread URL for instant mobile AR.
 */
export function DesktopQRModal({
  item,
  customUrl,
  customTitle,
  customSubtitle,
  onClose
}: DesktopQRModalProps) {
  const [copied, setCopied] = useState(false);

  const isOpen = Boolean(item || customUrl);

  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const deepLinkUrl = customUrl ?? (item ? getDishDeepLinkUrl(item.id) : '');
  const heading = customTitle ?? item?.name ?? 'Table AR Preview';
  const subheading =
    customSubtitle ??
    (item?.realWorldDimensions ? `True 1:1 Scale • ${item.realWorldDimensions}` : 'True 1:1 Scale');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deepLinkUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable in non-HTTPS contexts
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Scan QR to view ${heading} in AR`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#1C1917]/95 p-7 text-center backdrop-blur-2xl shadow-glass"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR handoff modal"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#A8A29E] transition hover:text-[#F7F3EC]"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-[#D96B27]/40 bg-[#D96B27]/15 px-3 py-1 text-xs font-medium text-[#F4A26E]">
            <Smartphone className="h-3.5 w-3.5" />
            Instant Mobile WebAR Handoff
          </div>

          <h2 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-[#F7F3EC]">
            {heading}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#A8A29E]">
            <Ruler className="h-3.5 w-3.5 text-[#D96B27]" />
            {subheading}
          </p>

          <div className="mx-auto mt-6 inline-flex rounded-2xl border border-white/15 bg-[#F7F3EC] p-4 shadow-glass">
            <QRCodeSVG
              value={deepLinkUrl}
              size={200}
              bgColor="#F7F3EC"
              fgColor="#12100E"
              level="M"
            />
          </div>

          <p className="mx-auto mt-5 max-w-xs text-sm leading-relaxed text-[#A8A29E]">
            Scan with your phone camera to place {customUrl ? 'your full meal spread' : 'this dish'} on your table in 1:1 size — no app required.
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-[#F7F3EC] transition hover:border-white/20 hover:bg-white/10"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#22C55E]" />
                  Link Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-[#A8A29E]" />
                  Copy AR Link
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
