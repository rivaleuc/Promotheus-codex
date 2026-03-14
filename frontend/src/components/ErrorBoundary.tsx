import React from "react";

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ui-error]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="p-card" style={{ maxWidth: 640, width: "100%", padding: 24 }}>
            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: "1.1rem", marginBottom: 10 }}>UI Error</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {this.state.error.message || "Unknown error"}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
