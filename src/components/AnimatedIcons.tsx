import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Animation, EventProps } from 'react-useanimations';
import copy from 'react-useanimations/lib/copy';
import download from 'react-useanimations/lib/download2';
import notification from 'react-useanimations/lib/notification4';
import loading from 'react-useanimations/lib/loading2';
import refresh from 'react-useanimations/lib/refresh2';
import visibility from 'react-useanimations/lib/visibility';
import check from 'react-useanimations/lib/checkmark';
import { Bell, Check, Copy, Download, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';

type Kind = 'copy' | 'download' | 'bell' | 'loading' | 'refresh' | 'visibility' | 'success';
const UseAnimations = React.lazy(() => import('react-useanimations'));
type Props = React.HTMLAttributes<HTMLSpanElement> & { size?: number | string; active?: boolean; trigger?: number };
const assets: Record<Kind, Animation> = { copy, download, bell: notification, loading, refresh, visibility, success: check };
const reducedQuery = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (listener: () => void) => {
  const query = window.matchMedia?.(reducedQuery);
  query?.addEventListener?.('change', listener);
  return () => query?.removeEventListener?.('change', listener);
};
const getReducedMotion = () => Boolean(window.matchMedia?.(reducedQuery).matches);

/** Decorative SVGs only. The existing parent button retains its action and label. */
function AnimatedIcon({ kind, className = 'h-5 w-5', size, active, trigger = 0, style, ...props }: Props & { kind: Kind }) {
  const host = useRef<HTMLSpanElement>(null);
  const handlers = useRef<EventProps | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, getReducedMotion, () => true);
  const spinning = kind === 'loading' || (kind === 'refresh' && className.includes('animate-spin'));
  const frames = assets[kind].animationData as { ip?: number; op?: number; fr?: number };
  const speed = spinning ? 1 : Math.max(1, ((frames.op ?? 30) - (frames.ip ?? 0)) / (frames.fr || 30) / 0.16);
  const classes = className.replace(/\banimate-spin\b/g, '').trim();
  useEffect(() => {
    if (reduced || spinning || kind === 'bell' || kind === 'success') return;
    const button = host.current?.closest('button,a,[role="button"]');
    if (!button) return;
    // Binding to the button also covers tapping its text and keyboard activation.
    // The animation handlers never invoke, delay, or prevent the real action.
    const bindings = [
      ['click','onClick'], ['mouseenter','onMouseEnter'], ['mouseleave','onMouseLeave'],
      ['pointerenter','onPointerEnter'], ['focus','onFocus'], ['blur','onBlur'],
    ] as const;
    const cleanup = bindings.map(([event, handler]) => {
      const listener = (value: Event) => {
        if (button.matches(':disabled,[aria-disabled="true"]')) return;
        (handlers.current?.[handler] as unknown as ((value: Event) => void) | undefined)?.(value);
      };
      button.addEventListener(event, listener);
      return () => button.removeEventListener(event, listener);
    });
    return () => cleanup.forEach(remove => remove());
  }, [kind, spinning, reduced]);
  const Static = kind === 'copy' ? Copy : kind === 'download' ? Download : kind === 'bell' ? Bell
    : kind === 'loading' ? Loader2 : kind === 'refresh' ? RefreshCw : kind === 'success' ? Check : active ? EyeOff : Eye;
  return <span {...props} ref={host} data-motion-icon={kind} aria-hidden="true"
    className={`inline-flex shrink-0 align-middle ${classes}`}
    style={{ pointerEvents: 'none', ...(size ? { width:size,height:size } : {}), ...style }}>
    {reduced ? <Static className="h-full w-full" /> : <React.Suspense fallback={<Static className="h-full w-full" />}><UseAnimations
      key={kind === 'bell' ? trigger : kind}
      animation={assets[kind]} size="100%" strokeColor="currentColor"
      speed={speed}
      interaction={spinning ? 'loop' : kind === 'visibility' ? 'click-toggle' : 'click-replay'}
      active={kind === 'visibility' ? active : undefined}
      loop={spinning}
      autoplay={spinning ? undefined : kind === 'success' || (kind === 'bell' && trigger > 0)}
      render={(events, animationProps) => { handlers.current = events; return <span {...animationProps} />; }}
    /></React.Suspense>}
  </span>;
}
export const CopyIcon = (props: Props) => <AnimatedIcon {...props} kind="copy" />;
export const DownloadIcon = (props: Props) => <AnimatedIcon {...props} kind="download" />;
export const BellIcon = (props: Props) => <AnimatedIcon {...props} kind="bell" />;
export const LoadingIcon = (props: Props) => <AnimatedIcon {...props} kind="loading" />;
export const RefreshIcon = (props: Props) => <AnimatedIcon {...props} kind="refresh" />;
export const PasswordVisibilityIcon = (props: Props) => <AnimatedIcon {...props} kind="visibility" />;
export const SuccessIcon = (props: Props) => <AnimatedIcon {...props} kind="success" />;
