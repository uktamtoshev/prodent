import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: попытка перейти на несуществующий маршрут:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-7xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold text-foreground">Страница не найдена</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Возможно, ссылка устарела или страница была перемещена.
      </p>
      <Button asChild className="mt-6 gap-2">
        <Link to="/">
          <Home className="h-4 w-4" />
          На главную
        </Link>
      </Button>
    </div>
  );
};

export default NotFound;
