import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-wide error boundary. Without this, a render error in ANY page component
 * unmounts the whole React tree and leaves the user on a blank white screen
 * with no way to recover except a manual reload. This catches the crash and
 * shows a friendly fallback with a reload action instead.
 *
 * Text is Russian (the app's primary locale) on purpose — a class component
 * cannot use the LanguageContext hook, and the fallback must stay dependency-free
 * so it still renders even if a context provider is what threw.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Перехвачена ошибка интерфейса:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Что-то пошло не так
          </h1>
          <p className="mb-6 text-muted-foreground">
            Произошла непредвиденная ошибка на этой странице. Попробуйте обновить —
            остальная часть приложения продолжает работать.
          </p>
          <Button onClick={this.handleReload} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Обновить страницу
          </Button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-6 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
