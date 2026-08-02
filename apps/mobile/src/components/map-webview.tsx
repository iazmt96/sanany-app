import type { StyleProp, ViewStyle } from "react-native";
import WebView from "react-native-webview";

type Props = {
  html: string;
  style?: StyleProp<ViewStyle>;
  onMessage(data: string): void;
};

export function MapWebView({ html, style, onMessage }: Props) {
  return (
    <WebView
      source={{ html }}
      style={style}
      onMessage={(e) => onMessage(e.nativeEvent.data)}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
    />
  );
}
