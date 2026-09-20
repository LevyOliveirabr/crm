-- Limpeza do multi-empresa. Aplicar SOMENTE depois que o código da migration
-- 0008 estiver publicado e estável (o app já lê `emitentes`, grava
-- `emitente_id` explicitamente e usa `usuario_emitentes` para perfil/gerente).
--
--   1. remove os defaults de emitente_id (a partir daqui o app tem de informar)
--   2. remove a tabela antiga `emitente` (singleton) e as chaves config.orcamento_*
--   3. remove usuarios.gerente_id (o gerente é por empresa em usuario_emitentes)
--   4. remove o registro auxiliar config.emitente_padrao_id
-- Idempotente.

alter table negociacoes alter column emitente_id drop default;
alter table produtos alter column emitente_id drop default;
alter table metas alter column emitente_id drop default;

drop table if exists emitente;

delete from config where chave in ('orcamento_prefixo', 'orcamento_proximo_numero', 'emitente_padrao_id');

alter table usuarios drop column if exists gerente_id;
