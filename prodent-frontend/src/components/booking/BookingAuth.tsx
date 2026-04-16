import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function BookingAuth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Ошибка входа: " + error.message);
    } else {
      toast.success("Вход выполнен успешно");
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          role: "patient",
        },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });

    if (error) {
      toast.error("Ошибка регистрации: " + error.message);
    } else {
      toast.success("Регистрация успешна! Теперь вы можете записаться на прием");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto">
      <p className="text-slate-300 text-center mb-6">
        Для записи на прием необходимо войти или зарегистрироваться
      </p>

      <Tabs defaultValue="signin" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-700">
          <TabsTrigger value="signin">Вход</TabsTrigger>
          <TabsTrigger value="signup">Регистрация</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="signin-email" className="text-slate-300">Email</Label>
              <Input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="signin-password" className="text-slate-300">Пароль</Label>
              <PasswordInput
                id="signin-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                iconClassName="text-slate-400 hover:text-white"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <Label htmlFor="signup-name" className="text-slate-300">ФИО</Label>
              <Input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div>
              <Label htmlFor="signup-phone" className="text-slate-300">Телефон</Label>
              <Input
                id="signup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div>
              <Label htmlFor="signup-email" className="text-slate-300">Email</Label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="signup-password" className="text-slate-300">Пароль</Label>
              <PasswordInput
                id="signup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-slate-700 border-slate-600 text-white"
                iconClassName="text-slate-400 hover:text-white"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
