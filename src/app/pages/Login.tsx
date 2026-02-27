import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MushroomIcon } from '../../components/MushroomIcon';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulação de login
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3B2F28] to-[#1A1A1A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#A88F52] rounded-full mb-4">
            <MushroomIcon className="w-12 h-12 text-white" />
          </div>
          <h1 className="font-['Cormorant_Garamond'] text-white mb-2" style={{ fontSize: '42px', fontWeight: 700 }}>
            Shroom Bros
          </h1>
          <p className="text-[#A88F52]" style={{ fontSize: '18px' }}>
            Gestão de Produção
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="font-['Cormorant_Garamond'] mb-6 text-center" style={{ fontSize: '28px', fontWeight: 600 }}>
            Entrar no Sistema
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="fabio@shroombros.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-[#A88F52] hover:bg-[#8F7742]">
              Entrar
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[#1A1A1A] opacity-60">
            <p>Acesso restrito aos colaboradores da Shroom Bros</p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-white opacity-70">
          <p>Versão 1.0 • Dezembro 2024</p>
        </div>
      </div>
    </div>
  );
}