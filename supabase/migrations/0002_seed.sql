-- CRM Comercial F-Led — migration 0002: seed inicial
-- Gerado a partir de SPEC.md (seção 3.3). Confirmar listas com o diretor antes de rodar em produção.

insert into funis (nome, ordem) values ('Prospecção', 1), ('Projetos', 2);

-- etapas de Prospecção
insert into etapas (funil_id, nome, ordem, dica, conta_como_proposta)
select id, e.nome, e.ordem, e.dica, e.prop from funis, (values
  ('Lista', 1, 'Empresa identificada, ainda sem conversa.', false),
  ('Contato feito', 2, 'Falou com alguém e a pessoa respondeu.', false),
  ('Interesse', 3, 'Sabe o que o cliente precisa e mais ou menos quanto.', false),
  ('Proposta enviada', 4, 'Orçamento registrado e enviado.', true),
  ('Negociação final', 5, 'Cliente respondeu à proposta; ajuste de preço, prazo ou escopo.', false)
) as e(nome, ordem, dica, prop) where funis.nome = 'Prospecção';

-- etapas de Projetos
insert into etapas (funil_id, nome, ordem, dica, conta_como_proposta)
select id, e.nome, e.ordem, e.dica, e.prop from funis, (values
  ('Necessidade mapeada', 1, 'Escopo e quantidade conhecidos.', false),
  ('Orçamento enviado', 2, 'Orçamento registrado e enviado.', true),
  ('Negociação final', 3, 'Cliente respondeu; ajuste de preço, prazo ou escopo.', false),
  ('Pedido', 4, 'Pedido de compra recebido, aguardando faturamento.', false)
) as e(nome, ordem, dica, prop) where funis.nome = 'Projetos';

insert into listas (tipo, valor, ordem) values
  ('linha','Iluminação pública',1),('linha','Iluminação industrial',2),('linha','Iluminação comercial',3),('linha','Serviços',4),
  ('origem','Indicação',1),('origem','Prospecção ativa',2),('origem','Licitação',3),('origem','Site',4),('origem','Cliente antigo',5),
  ('motivo_perda','Preço',1),('motivo_perda','Concorrente',2),('motivo_perda','Sem resposta',3),('motivo_perda','Projeto cancelado',4),('motivo_perda','Prazo',5),('motivo_perda','Outro',6),
  ('segmento','Engenharia',1),('segmento','Construtora',2),('segmento','Indústria',3),('segmento','Varejo',4),('segmento','Órgão público',5),('segmento','Distribuidor',6);

insert into config (chave, valor) values
  ('dias_parada_negociacao','30'),('dias_parada_empresa','60'),
  ('peso_fria','0.2'),('peso_morna','0.5'),('peso_quente','0.8'),
  ('alerta_validade_orcamento_dias','3'),
  ('orcamento_prefixo','ORC'),('orcamento_proximo_numero','1');

insert into emitente (id, razao_social) values (1, 'F-Led');  -- completar em Configurações
-- a migration 0008 converte esta linha em `emitentes` (multi-empresa); 0009 remove a tabela antiga
