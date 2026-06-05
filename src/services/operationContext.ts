import { randomUUID } from 'crypto';

/**
 * Gera um UUID único para rastrear e agrupar todas as chamadas de API 
 * vinculadas a uma única transação/ação realizada pelo usuário final.
 * 
 * Deve ser instanciado no controller ou rota Express e propagado 
 * para os serviços chamados em cadeia.
 */
export function createOperationId(): string {
  return randomUUID();
}
