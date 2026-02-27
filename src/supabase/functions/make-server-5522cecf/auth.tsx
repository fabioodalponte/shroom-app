import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const USER_TYPES = ['admin', 'producao', 'motorista', 'vendas', 'cliente'] as const;
type UserType = (typeof USER_TYPES)[number];

function normalizeUserType(value: string): UserType | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return USER_TYPES.includes(normalized as UserType) ? (normalized as UserType) : null;
}

export async function getUsersCount() {
  const { count, error } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Erro ao contar usuários:', error);
    throw new Error('Não foi possível validar estado de configuração');
  }

  return count ?? 0;
}

/**
 * Cadastro de novo usuário (Sign Up)
 */
export async function signUp(data: {
  email: string;
  password: string;
  nome: string;
  telefone?: string;
  tipo_usuario: string;
}) {
  try {
    const tipoUsuario = normalizeUserType(data.tipo_usuario);
    if (!tipoUsuario) {
      return {
        success: false,
        error: 'tipo_usuario inválido',
      };
    }

    // 1. Criar usuário no Supabase Auth
    // IMPORTANTE: email_confirm: true pois não temos servidor de email configurado
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirma email (sem servidor de email)
      user_metadata: {
        nome: data.nome,
        tipo_usuario: tipoUsuario,
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário no auth:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Usuário não foi criado');
    }

    // 2. Criar registro na tabela usuarios
    const { error: dbError } = await supabase
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        tipo_usuario: tipoUsuario,
        ativo: true,
      });

    if (dbError) {
      console.error('Erro ao criar usuário no banco:', dbError);
      // Tentar deletar o usuário do auth se falhar
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    return {
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        nome: data.nome,
        tipo_usuario: tipoUsuario,
      }
    };

  } catch (error: any) {
    console.error('Erro no signup:', error);
    return {
      success: false,
      error: error.message || 'Erro ao criar usuário'
    };
  }
}

/**
 * Verifica se o usuário está autenticado
 */
export async function verifyAuth(accessToken: string | null) {
  if (!accessToken) {
    return { authenticated: false, user: null };
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      return { authenticated: false, user: null };
    }

    // Buscar dados completos do usuário na tabela usuarios
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(); // Usar maybeSingle() ao invés de single() para não dar erro se não existir

    if (userError) {
      console.error('Erro ao buscar dados do usuário:', userError);
      return { authenticated: true, user: { id: user.id, email: user.email } };
    }
    
    console.log('🔍 Busca por ID:', user.id);
    console.log('🔍 Resultado da busca por ID:', userData ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
    console.log('🔍 Email do usuário autenticado:', user.email);
    
    // Se o usuário não existe na tabela usuarios, criar automaticamente
    if (!userData) {
      console.log('👤 Usuário não encontrado na tabela usuarios. Verificando...');
      
      // PRIMEIRO: Verificar se já existe um usuário com esse email
      const { data: existingUserByEmail } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      
      if (existingUserByEmail) {
        console.log('✅ Usuário já existe na tabela (encontrado por email):', existingUserByEmail);
        return {
          authenticated: true,
          user: existingUserByEmail
        };
      }
      
      // Se não existe, criar novo registro
      console.log('👤 Criando novo registro na tabela usuarios...');
      
      const { data: newUser, error: createError } = await supabase
        .from('usuarios')
        .insert({
          id: user.id,
          email: user.email,
          nome: user.user_metadata?.nome || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
          telefone: user.user_metadata?.phone || null,
          tipo_usuario: 'admin',
          ativo: true,
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erro ao criar usuário na tabela usuarios:', createError);
        
        // Se for erro de duplicação (23505), buscar o usuário existente NOVAMENTE
        // (pode ter sido criado entre a verificação e o insert)
        if (createError.code === '23505') {
          console.log('⚠️ Conflito de duplicação detectado. Buscando usuário...');
          const { data: existingUser } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();
          
          if (existingUser) {
            console.log('✅ Usuário existente encontrado após conflito:', existingUser);
            return {
              authenticated: true,
              user: existingUser
            };
          }
        }
        
        // Retornar dados básicos mesmo se falhar
        return { 
          authenticated: true, 
          user: { 
            id: user.id, 
            email: user.email,
            nome: user.user_metadata?.nome || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
            tipo_usuario: 'admin'
          } 
        };
      }

      console.log('✅ Usuário criado com sucesso na tabela usuarios:', newUser);
      return {
        authenticated: true,
        user: newUser
      };
    }

    return {
      authenticated: true,
      user: userData
    };

  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return { authenticated: false, user: null };
  }
}

/**
 * Middleware para rotas protegidas
 */
export async function requireAuth(accessToken: string | null) {
  const { authenticated, user } = await verifyAuth(accessToken);
  
  if (!authenticated || !user) {
    throw new Error('Não autorizado');
  }

  return user;
}
