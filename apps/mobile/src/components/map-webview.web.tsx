import { useEffect } from "react";

type Props = {
  html: string;
  style?: React.CSSProperties;
  onMessage(data: string): void;
};

export function MapWebView({ html, onMessage, style }: Props) {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        onMessage(event.data);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  return (
    <iframe
      srcDoc={html}
      // eslint-disable-next-line react-native/no-inline-styles
      style={{ flex: 1, border: "none", width: "100%", height: "100%", ...style }}
      sandbox="allow-scripts"
      title="map"
    />
  );
}
