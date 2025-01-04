import { z } from "zod";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  forwardRef,
} from "react";

type ZodProps<T extends z.Schema<unknown>> = z.util.flatten<z.infer<T>> & {
  /**
   * When the props change in the guest frame, this function will be called with the new props for the host frame.
   */
  onPropsChange?: (value: z.infer<T>) => void;
};

type HostFrameProps<T extends z.Schema<unknown>> =
  React.IframeHTMLAttributes<HTMLIFrameElement> & ZodProps<T>;

/**
 * Merges multiple refs into a single ref callback.
 *
 * source: github.com/gregberge/react-merge-refs
 */
function mergeRefs<T = unknown>(
  refs: Array<React.MutableRefObject<T> | React.LegacyRef<T> | undefined | null>
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

type GuestFrameOptions<T extends z.Schema<unknown>> = {
  src: string;
  schema: T;
  targetOrigin?: string;
};

export function getGuestFrame<T extends z.Schema<unknown>>({
  src,
  schema,
  targetOrigin = "*",
}: GuestFrameOptions<T>) {
  return forwardRef(function GuestFrame(
    { onPropsChange, ...props }: HostFrameProps<T>,
    parentRef: React.Ref<HTMLIFrameElement>
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [, setLoaded] = useState(false);
    const attributes = schema.parse(props);
    const attributesRef = useRef(attributes);

    const updateAttributes = useCallback(
      async (attributes: unknown) => {
        iframeRef?.current?.contentWindow?.postMessage(
          { type: MessageType.Change, value: attributes },
          targetOrigin
        );
        attributesRef.current = attributes;
      },
      [targetOrigin]
    );

    useEffect(() => {
      async function handleMessage(event: MessageEvent) {
        // check that the event doesn't come from this window
        if (event.source === window) {
          return;
        }

        if (event.data.type === MessageType.Ready) {
          await updateAttributes(attributesRef.current);
          return;
        }
        
        if (event.data.type === MessageType.Change) {
          const newAttributes = schema.safeParse(event.data.value);
          if (!newAttributes.success) {
            return;
          }

          onPropsChange?.(newAttributes.data);
        }
      }

      window.addEventListener("message", handleMessage);
      return () => {
        window.removeEventListener("message", handleMessage);
      };
    }, [updateAttributes]);

    useEffect(() => {
      const iframe = iframeRef.current;

      async function handleLoad() {
        iframe?.contentWindow?.postMessage(
          { type: "change", value: attributesRef.current },
          targetOrigin
        );
        await updateAttributes(attributesRef.current);
        setLoaded(false);
      }

      iframe?.addEventListener("load", handleLoad);
      return () => {
        iframe?.removeEventListener("load", handleLoad);
      };
    }, [updateAttributes]);

    useEffect(() => {
      updateAttributes(attributes);
    }, [attributes, updateAttributes]);

    return (
      <iframe
        title={props.title}
        {...props}
        src={src}
        ref={mergeRefs([parentRef, iframeRef])}
      />
    );
  });
}

enum MessageType {
  Ready = "ready",
  Change = "change",
}

const eventPayloadSchema = z.object({
  type: z.nativeEnum(MessageType),
  value: z.any(),
});

type HostFrameOptions<T extends z.Schema<unknown>> = {
  schema: T;
  initial: z.infer<T>;
  targetOrigin?: string;
};
export const getHost = function <T extends z.Schema<unknown>>({
  schema,
  initial,
  targetOrigin = "*",
}: HostFrameOptions<T>) {
  let value: z.infer<T> | undefined;
  const attributes = schema.parse(initial);

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
    if (event.data.source === "react-devtools-content-script") {
      return;
    }

    // check that the event doesn't come from this window
    if (event.source === window) {
      return;
    }

    const payload = eventPayloadSchema.safeParse(event.data);
    if (!payload.success) {
      return;
    }

    if (payload.data.type === MessageType.Ready) {
      return;
    }

    if (payload.data.type === MessageType.Change) {
      const newAttributes = schema.safeParse(payload.data.value);
      if (!newAttributes.success) {
        return;
      }

      value = newAttributes.data;
      for (const listener of listeners) {
        listener(value);
      }
    }
  }

  function init() {
    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "ready" }, targetOrigin);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  return {
    useHostProps(): z.infer<T> {
      return useSyncExternalStore(subscribe, getSnapshot);
    },
    dispatchChange(value: z.infer<T>) {
      const message = { type: MessageType.Change, value };
      window.parent.postMessage(message, targetOrigin);
    },
  };
};
