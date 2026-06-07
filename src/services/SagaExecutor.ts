import { SupabaseClient } from '@supabase/supabase-js';
import { WalletService } from './WalletService';

/**
 * Interface que representa a definição básica para o pattern Saga
 */
export interface SagaPhaseParams {
   supabase: SupabaseClient;
   userId: string;
   // Pode injetar outras propriedades necessárias
   [key: string]: any;
}

export class SagaExecutor {
  /**
   * Executa uma transação coordenada:
   * 1. Adquire e retém o valor do saldo original.
   * 2. Ajusta a carteira (fase 1: débito ou crédito).
   * 3. Executa a operação no Database Relacional (fase 2).
   * 4. Se a Fase 2 falha, realiza Rollback Automático via Facade.
   * 
   * @param params 
   * @param walletAdjustment O valor que vai MUDAR na carteira (pode ser negativo para debit, positivo para credit)
   * @param businessAction A ação do banco de dados relacional que acontece APÓS a carteira (ex: inserts, deletes, events)
   */
  static async executeWithWalletLedger(
    supabase: SupabaseClient,
    userId: string,
    walletAdjustment: number,
    businessAction: (currentBalance: number, newBalance: number) => Promise<any>
  ) {
     
     // 1. Obtém o snapshot
     const originalBalance = await WalletService.getBalance(supabase, userId);
     let finalBalance = originalBalance;

     // 2. Tenta a dedução/crédito apenas se houver ajuste diferente de zero
     if (walletAdjustment !== 0) {
        if (originalBalance + walletAdjustment < 0) {
           throw new Error('Saldo insuficiente para realizar a transação.');
        }

        const adjustmentRes = walletAdjustment < 0 
           ? await WalletService.debit(supabase, userId, Math.abs(walletAdjustment))
           : await WalletService.credit(supabase, userId, Math.abs(walletAdjustment));
        
        finalBalance = adjustmentRes.newBalance;
     }

     // 3. Fase 2: Regera/Updates Base de Dados
     try {
        const result = await businessAction(originalBalance, finalBalance);
        return result;
     } catch (dbError: any) {
        console.error('Saga Executor - Erro na gravação das entidades DBR. Iniciando compensação (Rollback)...', dbError);
        
        if (walletAdjustment !== 0) {
           try {
              await WalletService.rollback(supabase, userId, originalBalance);
           } catch (fatalError: any) {
              console.error(`🔴 CRÍTICO: SAGA ROLLBACK FALHOU — inconsistência financeira detectada. Saldo esperado: ${originalBalance}. Erro fatal:`, fatalError);
           }
        }

        // Lança o erro original para cima após terminar o processamento interno (ou sua compesação)
        throw dbError;
     }
  }
}
