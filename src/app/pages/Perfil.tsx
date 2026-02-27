import { User, Mail, Phone, Calendar, Shield, LogOut, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Perfil() {
  const { usuario, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso!');
      navigate('/login');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="p-6">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Não foi possível carregar o perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Verifique a conexão com o servidor e tente novamente.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => window.location.reload()}>
                Tentar Novamente
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate('/login');
                }}
              >
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tipoUsuarioLabel = {
    admin: 'Administrador',
    producao: 'Produção',
    motorista: 'Motorista',
    vendas: 'Vendas',
    cliente: 'Cliente'
  }[usuario.tipo_usuario];

  const nivelAcesso = {
    admin: 'Total',
    producao: 'Produção e Estoque',
    motorista: 'Entregas',
    vendas: 'Vendas e Clientes',
    cliente: 'Limitado'
  }[usuario.tipo_usuario];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Meu Perfil
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Informações da conta e configurações
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="border-red-200 text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              {usuario.avatar_url ? (
                <img
                  src={usuario.avatar_url}
                  alt={usuario.nome}
                  className="w-24 h-24 rounded-full object-cover mb-4"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-full flex items-center justify-center mb-4">
                  <User className="w-12 h-12 text-white" />
                </div>
              )}
              
              <h2 className="font-['Cormorant_Garamond']" style={{ fontSize: '28px', fontWeight: 700 }}>
                {usuario.nome}
              </h2>
              
              <p className="text-[#A88F52] mt-1">{tipoUsuarioLabel}</p>
              
              <div className="flex items-center gap-2 mt-3 text-sm text-[#1A1A1A] opacity-70">
                <Calendar size={14} />
                <span>
                  Membro desde {format(new Date(usuario.created_at || new Date()), 'MMM yyyy', { locale: ptBR })}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#E3E3E3] space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield size={16} className="text-[#546A4A]" />
                <span>Nível de Acesso: {nivelAcesso}</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <Mail size={16} className="text-[#546A4A]" />
                <span className="truncate">{usuario.email}</span>
              </div>

              {usuario.telefone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={16} className="text-[#546A4A]" />
                  <span>{usuario.telefone}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${usuario.ativo ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{usuario.ativo ? 'Conta Ativa' : 'Conta Inativa'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Information Cards */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">ID do Usuário</p>
                  <p className="font-mono text-xs mt-1 truncate">{usuario.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tipo de Conta</p>
                  <p className="mt-1">{tipoUsuarioLabel}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="mt-1">{usuario.email}</p>
              </div>

              {usuario.telefone && (
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="mt-1">{usuario.telefone}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${usuario.ativo ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>{usuario.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissões */}
          <Card>
            <CardHeader>
              <CardTitle>Permissões de Acesso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usuario.tipo_usuario === 'admin' && (
                  <>
                    <PermissionItem label="Gestão de Usuários" granted />
                    <PermissionItem label="Gestão de Lotes" granted />
                    <PermissionItem label="Gestão de Estoque" granted />
                    <PermissionItem label="Gestão de Vendas" granted />
                    <PermissionItem label="Gestão de Logística" granted />
                    <PermissionItem label="Gestão Financeira" granted />
                    <PermissionItem label="Configurações do Sistema" granted />
                  </>
                )}

                {usuario.tipo_usuario === 'producao' && (
                  <>
                    <PermissionItem label="Gestão de Lotes" granted />
                    <PermissionItem label="Registro de Colheitas" granted />
                    <PermissionItem label="Visualizar Estoque" granted />
                    <PermissionItem label="Gestão Financeira" granted={false} />
                    <PermissionItem label="Configurações do Sistema" granted={false} />
                  </>
                )}

                {usuario.tipo_usuario === 'motorista' && (
                  <>
                    <PermissionItem label="Visualizar Entregas" granted />
                    <PermissionItem label="Atualizar Status de Entrega" granted />
                    <PermissionItem label="Gestão de Lotes" granted={false} />
                    <PermissionItem label="Gestão Financeira" granted={false} />
                  </>
                )}

                {usuario.tipo_usuario === 'vendas' && (
                  <>
                    <PermissionItem label="Gestão de Clientes" granted />
                    <PermissionItem label="Gestão de Pedidos" granted />
                    <PermissionItem label="Visualizar Estoque" granted />
                    <PermissionItem label="Gestão de Lotes" granted={false} />
                    <PermissionItem label="Gestão Financeira" granted={false} />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PermissionItem({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm">{label}</span>
      <div className={`px-2 py-1 rounded text-xs ${
        granted 
          ? 'bg-green-100 text-green-700' 
          : 'bg-red-100 text-red-700'
      }`}>
        {granted ? 'Concedido' : 'Negado'}
      </div>
    </div>
  );
}
