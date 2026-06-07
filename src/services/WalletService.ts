import { SupabaseClient } from '@supabase/supabase-js';

// @camada2: Atualmente, a carteira reside no user_metadata por dívida técnica consciente.
// Esta camada atua como uma Facade para isolar a transação e preparar a futura migração 
// para uma tabela de Ledger relacional dedicada (esquema de créditos real).

export class WalletService {
  /**
   * Obtém o saldo atual da carteira de um usuário.
   */
  static async getBalance(supabase: SupabaseClient, userId: string): Promise<number> {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      throw new Error('Falha ao obter dados do usuário para verificar saldo.');
    }

    let profile = userData.user.user_metadata || {};
    
    // Inicialização segura
    if (typeof profile.wallet_balance !== 'number') {
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { ...profile, wallet_balance: 40.00 }
      });
      
      if (updateError) {
        throw new Error('Falha ao inicializar a carteira do usuário.');
      }
      profile = (updatedUser.user as any).user_metadata || { wallet_balance: 40.00 };
    }

    return profile.wallet_balance;
  }

  /**
   * Remove fundos (debit/credit logic based on math) da carteira explicitamente (usado para downgrade também reavendo).
   * Note que amount positivo debita na carteira, enquanto crédito adiciona.
   */
  static async debit(supabase: SupabaseClient, userId: string, amountToDebit: number): Promise<{ oldBalance: number, newBalance: number }> {
     return this._adjustWallet(supabase, userId, -amountToDebit);
  }

  static async credit(supabase: SupabaseClient, userId: string, amountToCredit: number): Promise<{ oldBalance: number, newBalance: number }> {
     return this._adjustWallet(supabase, userId, amountToCredit);
  }

  /**
   * Restaura a carteira ao estado original em caso de falha.
   */
  static async rollback(supabase: SupabaseClient, userId: string, originalAmount: number): Promise<void> {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const profile = userData?.user?.user_metadata || {};

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...profile, wallet_balance: originalAmount }
    });

    if (updateError) {
       // @camada2: se ocorrer erro num rollback, a consistência real do Ledger será necessária.
       throw new Error(`Rollback falhou para o usuário ${userId}. Valor a restaurar era ${originalAmount}. Erro: ${updateError.message}`);
    }
  }

  /**
   * Ajuste interno isolado
   */
  private static async _adjustWallet(supabase: SupabaseClient, userId: string, adjustment: number): Promise<{ oldBalance: number, newBalance: number }> {
    const currentBalance = await this.getBalance(supabase, userId);
    const newBalance = currentBalance + adjustment;

    // TODO: Adicionar validação de limite mínimo (permitir negativo se houver margem? Atualmente, não é imposto estritamente aqui sem saber negócio).
    // O ideal é a lógica de negócio validar o saldo antes (e.g. SagaExecutor).
    
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const profile = userData?.user?.user_metadata || {};

    const { error: updateProfileError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...profile, wallet_balance: newBalance }
    });

    if (updateProfileError) {
      throw new Error(`Falha ao ajustar saldo via Facade WalletService: ${updateProfileError.message}`);
    }

    return { oldBalance: currentBalance, newBalance };
  }
}
