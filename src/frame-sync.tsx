import { z } from 'zod';
import React, { createContext, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

type HostFrameProps<T extends z.util.flatten<T>> = React.IframeHTMLAttributes<HTMLIFrameElement> & T;

export function getGuestFrame<T extends z.Schema<unknown>>({
  src,
  schema,
  targetOrigin = '*',
}: {
  src: string;
  schema: T;
  targetOrigin?: string;
}) {
  return function GuestFrame({ ...props }: HostFrameProps<z.infer<T>>) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [, setLoaded] = useState(false);
    const attributes = schema.parse(props);
    const attributesRef = useRef(attributes);

    const updateAttributes = useCallback(async (attributes: unknown) => {
      iframeRef?.current?.contentWindow?.postMessage({ type: 'change', value: attributes }, targetOrigin);
      attributesRef.current = attributes;
    }, []);

    useEffect(() => {
      async function handleMessage(event: MessageEvent) {
        // check that the event doesn't come from this window
        if (event.source === window) {
          return;
        }

        if (event.data.type === 'ready') {
          await updateAttributes(attributesRef.current);
        }
      }

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [updateAttributes]);

    useEffect(() => {
      const iframe = iframeRef.current;

      async function handleLoad() {
        iframe?.contentWindow?.postMessage({ type: 'change', value: attributesRef.current }, targetOrigin);
        await updateAttributes(attributesRef.current);
        setLoaded(false);
      }

      iframe?.addEventListener('load', handleLoad);
      return () => {
        iframe?.removeEventListener('load', handleLoad);
      };
    }, [updateAttributes]);

    useEffect(() => {
      updateAttributes(attributes);
    }, [attributes, updateAttributes]);

    return <iframe title={props.title} {...props} src={src} ref={iframeRef} />;
  };
}

export const getHost = function <T extends z.Schema<unknown>>({
  schema,
  initial,
  targetOrigin = '*',
}: {
  schema: T;
  initial: z.infer<T>;
  targetOrigin?: string;
}) {
  let value: T | undefined;

  const attributes = schema.parse(initial);
  const HostContext = createContext<z.infer<T>>(attributes);

  function getSnapshot(): z.infer<T> {
    return value ?? attributes;
  }

  const listeners = new Set<(attributes: z.infer<T>) => void>();

  function subscribe(callback: () => void) {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }

  function handleMessage(event: MessageEvent) {
    if (event.data.source === 'react-devtools-content-script') {
      return;
    }
    // check that the event doesn't come from this window
    if (event.source === window) {
      return;
    }

    if (event.data.type === 'ready') {
      return;
    }

    if (event.data.type === 'change') {
      value = event.data.value;
      const newAttributes = schema.parse(event.data.value);

      for (const listener of listeners) {
        listener(newAttributes);
      }
    }
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      window.addEventListener('message', handleMessage);
      window.parent.postMessage({ type: 'ready' }, targetOrigin);
    },
    { once: true },
  );

  return {
    Context: HostContext,
    Provider({ children }: { children: React.ReactNode }) {
      const value = useSyncExternalStore(subscribe, getSnapshot);
      return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
    },
    destroy() {
      window.removeEventListener('message', handleMessage);
    },
  };
};
