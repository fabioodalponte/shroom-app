import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchServer } from '../../utils/supabase/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Flower2, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';

export function SignupPage() {
  const navigate = useNavigate();
  const { user, usuario, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [setupStatusLoading, setSetupStatusLoading] = useState(true);
  const [allowPublicSignup, setAllowPublicSignup] = useState(false);
  const [firstUserMustBeAdmin, setFirstUserMustBeAdmin] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    telefone: '',
    tipo_usuario: 'producao' as 'admin' | 'producao' | 'motorista' | 'vendas' | 'cliente',
  });

  const userRole = String(usuario?.tipo_usuario || user?.user_metadata?.tipo_usuario || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const canUseSignup = allowPublicSignup || isAdmin;

  useEffect(() => {
    void loadSetupStatus();
  }, []);

  async function loadSetupStatus() {
    try {
      const data = await fetchServer('/setup/status');
      setAllowPublicSignup(!!data.allow_public_signup);
      setFirstUserMustBeAdmin(!!data.first_user_must_be_admin);

      if (data.first_user_must_be_admin) {
        setFormData((prev) => ({ ...prev, tipo_usuario: 'admin' }));
      }
    } catch (error) {
      console.error('Erro ao carregar status do setup:', error);
      setAllowPublicSignup(false);
      setFirstUserMustBeAdmin(false);
    } finally {
      setSetupStatusLoading(false);
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canUseSignup) {
      toast.error('Cadastro público desativado. Solicite ao administrador a criação do seu usuário.');
      return;
    }

    setLoading(true);

    try {
      const dataToSend = {
        ...formData,
        tipo_usuario: firstUserMustBeAdmin ? 'admin' : formData.tipo_usuario,
      };

      const result = await fetchServer('/signup', {
        method: 'POST',
        body: JSON.stringify(dataToSend),
      });

      if (result.success) {
        toast.success('Conta criada com sucesso!');

        if (allowPublicSignup && !isAdmin) {
          navigate('/login');
        } else {
          setFormData({
            nome: '',
            email: '',
            password: '',
            telefone: '',
            tipo_usuario: 'producao',
          });
        }
      }

    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || setupStatusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!canUseSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Cadastro Indisponível</h2>
          <p className="text-gray-600 mb-6">
            O cadastro público está desativado. Solicite ao administrador a criação da sua conta.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Voltar para login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo e Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl mb-4 shadow-lg">
            <Flower2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shroom Bros</h1>
          <p className="text-gray-600">
            {allowPublicSignup ? 'Criar Nova Conta' : 'Criar Usuário'}
          </p>
        </div>

        {/* Card de Cadastro */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para login
          </button>

          <h2 className="text-2xl font-bold text-gray-900 mb-6">Cadastro</h2>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Seu nome completo"
                required
                className="mt-1.5"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                required
                className="mt-1.5"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="mt-1.5"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="mt-1.5"
                disabled={loading}
              />
            </div>

            {firstUserMustBeAdmin ? (
              <div>
                <Label>Tipo de Usuário *</Label>
                <div className="mt-1.5 rounded-md border px-3 py-2 bg-gray-50 text-sm text-gray-700">
                  Administrador (primeiro usuário do sistema)
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="tipo">Tipo de Usuário *</Label>
                <Select
                  value={formData.tipo_usuario}
                  onValueChange={(value) => setFormData({ ...formData, tipo_usuario: value as any })}
                  disabled={loading}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="motorista">Motorista</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 mt-6"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2024 Shroom Bros. Cogumelos Premium.
        </p>
      </div>
    </div>
  );
}
