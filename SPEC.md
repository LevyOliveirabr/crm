# CRM Comercial F-Led — Especificação Técnica v1.2

**Data:** 12/09/2026 (v1.2: base de orçamento e exportação Excel; guia de uso no Cursor; correções de SQL e MCP) · **Autor:** Levy Oliveira · **Para:** desenvolvedor responsável
**Prazo da entrega 1:** segunda-feira 14/09/2026 (uso real na terça 15/09)
**Prazo da entrega 2:** sexta-feira 25/09/2026

Este documento é a fonte única de verdade para o desenvolvimento. A proposta funcional aprovada pela diretoria está resumida na seção 1; tudo o que vem depois é a especificação de implementação. Onde houver dúvida, vale a regra: **pedir o mínimo de quem vende, calcular o resto, e priorizar o relatório da presidência.**

---

## 0. Como usar esta especificação no Cursor

1. Crie o projeto com `npx create-next-app@latest crm-fled --typescript --tailwind --app --src-dir=false` e instale shadcn (`npx shadcn@latest init`).
2. Salve este arquivo na raiz como **`SPEC.md`** e crie **`.cursor/rules/crm.mdc`** com o conteúdo abaixo, para que toda conversa carregue o contexto:

```
---
description: Regras do projeto CRM F-Led
alwaysApply: true
---
- A fonte de verdade é SPEC.md. Antes de implementar qualquer tela ou tabela, leia a seção correspondente.
- Nunca invente campos, tabelas ou regras que não estejam em SPEC.md; se faltar algo, pergunte antes.
- Banco: Supabase/Postgres com RLS em todas as tabelas. Nunca usar service role em código de tela.
- Nomes de tabelas/colunas em português snake_case, exatamente como na seção 3.
- Toda mutação é Server Action validada com zod. Toda lista lê de uma view da seção 3.6 quando existir.
- Interface em português do Brasil, mobile-first (390px), moeda R$ 1.234,56, datas dd/mm/aaaa.
- Ao terminar uma tarefa, liste os critérios de aceite da seção 5/9 que ela cobre e como testar.
```

3. Trabalhe **em etapas, na ordem da seção 8**, uma conversa por etapa. Não peça "faça o sistema inteiro". Prompt inicial sugerido:

> Leia SPEC.md. Crie a pasta `supabase/migrations` com uma migration `0001_schema.sql` contendo exatamente o DDL das seções 3.2, 3.4, 3.5 e 3.6 (incluindo `create extension if not exists pg_trgm; create extension if not exists unaccent;` no topo) e `0002_seed.sql` com a seção 3.3. Depois gere `lib/database.types.ts` com `supabase gen types`. Não crie telas ainda.

Prompts seguintes, um por vez: "Implemente o login e o layout base (sidebar/barra inferior) conforme 5.1" → "Implemente /hoje conforme 5.2" → "/funil conforme 5.3" → e assim por diante. Após cada um, rode e teste antes do próximo.

4. Estrutura de pastas esperada (o Cursor deve segui-la):

```
app/
  (auth)/login/
  (app)/hoje/  funil/  negociacoes/[id]/  negociacoes/nova/  empresas/  empresas/[id]/  contatos/  relatorios/  configuracoes/  orcamentos/[id]/
  api/exportar/route.ts
  api/mcp/[transport]/route.ts
components/ui/          (shadcn)
components/crm/         (Cartao, Kanban, TimelineItem, MiniFormProximaAcao, BotoesInteracao, ...)
lib/supabase/{server,client,admin}.ts
lib/actions/{negociacoes,acoes,interacoes,orcamentos,empresas,contatos,config}.ts
lib/schemas/            (zod, compartilhado com MCP)
lib/excel.ts  lib/exportacoes.ts  lib/mcp-auth.ts  lib/format.ts
supabase/migrations/
```

5. Pontos em que o Cursor costuma errar neste projeto; confira:
   - Esquecer `security_invoker = true` nas views (relatório vaza dados entre vendedores).
   - Usar `service role` no front para "resolver" erro de RLS. Proibido.
   - Criar tabela `tarefas` em vez de `acoes`, ou `propostas` em vez de `orcamentos`. Os nomes são os da seção 3.
   - Colocar a lógica de "próxima ação obrigatória" no banco. Ela é de UI (R2, R3, R4).
   - Gerar PDF do relatório com biblioteca. Na entrega 1 é HTML + `@media print`.
   - No MCP, escrever o transporte à mão. Usar `mcp-handler`.

---

## 1. Resumo funcional (contexto para o desenvolvedor)

O sistema é um CRM comercial para a F-Led usado por um diretor comercial (que também vende) e por vendedores/representantes. Os usuários não têm disciplina para preencher cadastros longos; o sistema precisa funcionar bem mesmo com pouca informação.

Cadeia central: **Empresa → Contato → Negociação → Funil/Etapa → Próxima ação → Resultado (venda ou perda)**.

A saída mais importante é o **Relatório para a Presidência**: vendido no mês vs. anterior, previsão de fechamento dos próximos meses, maiores negociações abertas, perdas e motivos. Gerado em um clique, sem digitação.

Perfis: `diretor` (vê e edita tudo, configura o sistema) e `vendedor` (vê e edita só o que é dele; vê empresas/contatos de todos).

Funis são **parametrizáveis**: cadastro de funis e etapas, editável pelo diretor. Uma negociação pertence a um funil e a uma etapa desse funil.

---

## 2. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Front + API | **Next.js 15 (App Router), TypeScript** | Server Components para listas; Server Actions para mutações |
| UI | **Tailwind + shadcn/ui** | Mobile-first. Testar tudo em 390px de largura |
| Banco / Auth / Storage | **Supabase** (Postgres 15, Auth, Storage) | RLS obrigatório em todas as tabelas |
| Acesso ao banco | `@supabase/ssr` + `@supabase/supabase-js` | Sem ORM. Views SQL para relatórios |
| Validação | `zod` | Schemas compartilhados entre Server Actions e MCP |
| Kanban | `@dnd-kit/core` | Drag no desktop; botão "Mover para" no mobile |
| PDF do relatório | Página HTML com `@media print` + botão "Imprimir/Salvar PDF" | Entrega 1 |
| PDF do orçamento | `@react-pdf/renderer` em route handler server-side | Entrega 3; layout segue o modelo de orçamento anexo |
| Excel (orçamento e exportações) | `exceljs` server-side | Um único módulo `lib/excel.ts` usado por todas as telas |
| MCP | `@modelcontextprotocol/sdk` (Streamable HTTP) | Entrega 2 |
| Deploy | Vercel (front) + Supabase Cloud (banco) | Região `sa-east-1` |
| Repositório | GitHub, branch `main` protegida, deploy automático | |

Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (só server), `SUPABASE_JWT_SECRET` (só server, MCP), `APP_URL`.

Idioma da interface: português do Brasil. Moeda: BRL, formato `R$ 1.234.567,89`. Datas: `dd/mm/aaaa`. Timezone: `America/Sao_Paulo`.

---

## 3. Modelo de dados

### 3.1 Convenções

- Chaves primárias `uuid` com `gen_random_uuid()`.
- `criado_em timestamptz default now()`, `atualizado_em` com trigger.
- Soft delete apenas em `empresas`, `contatos`, `negociacoes` via coluna `arquivado_em` (nullable). Demais tabelas: delete físico.
- Nomes de tabelas e colunas em português, snake_case, sem acento.

### 3.2 DDL

```sql
-- =========================================================
-- USUÁRIOS (espelho de auth.users)
-- =========================================================
create type perfil_usuario as enum ('diretor','vendedor');

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil perfil_usuario not null default 'vendedor',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- cria a linha em usuarios quando um usuário é convidado/criado no Auth
create or replace function handle_new_auth_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email,
          coalesce((new.raw_user_meta_data->>'perfil')::perfil_usuario, 'vendedor'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger trg_auth_user after insert on auth.users for each row execute function handle_new_auth_user();

-- =========================================================
-- FUNIS E ETAPAS (parametrizáveis)
-- =========================================================
create table funis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table etapas (
  id uuid primary key default gen_random_uuid(),
  funil_id uuid not null references funis(id) on delete cascade,
  nome text not null,
  ordem int not null,
  dica text,                                   -- "quando mover para cá"
  conta_como_proposta boolean not null default false,
  ativo boolean not null default true,
  unique (funil_id, ordem)
);

-- =========================================================
-- LISTAS EDITÁVEIS
-- =========================================================
create type tipo_lista as enum ('segmento','linha','origem','motivo_perda');

create table listas (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_lista not null,
  valor text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  unique (tipo, valor)
);

create table config (
  chave text primary key,
  valor text not null
);

-- =========================================================
-- EMPRESAS E CONTATOS
-- =========================================================
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  uf char(2),
  segmento text,
  cnpj text,
  responsavel_id uuid references usuarios(id),
  observacoes text,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- unaccent não é IMMUTABLE; usar wrapper para poder indexar
create or replace function f_unaccent(text) returns text language sql immutable parallel safe as $$ select unaccent($1) $$;
create unique index empresas_nome_unico on empresas (lower(f_unaccent(nome))) where arquivado_em is null;
create index empresas_nome_trgm on empresas using gin (nome gin_trgm_ops);

create table contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  whatsapp text,               -- só dígitos com DDI, ex: 5531999998888
  email text,
  cargo text,
  decisor boolean not null default false,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- =========================================================
-- NEGOCIAÇÕES
-- =========================================================
create type status_negociacao as enum ('aberta','vendida','perdida');

create table negociacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  contato_id uuid references contatos(id),
  funil_id uuid not null references funis(id),
  etapa_id uuid not null references etapas(id),
  titulo text not null,
  linha text,
  origem text,
  valor_estimado numeric(14,2) not null default 0,
  temperatura smallint not null default 2 check (temperatura in (1,2,3)), -- 1 fria, 2 morna, 3 quente
  previsao_mes date,                       -- sempre dia 1 do mês
  responsavel_id uuid not null references usuarios(id),
  status status_negociacao not null default 'aberta',
  valor_final numeric(14,2),
  motivo_perda text,
  anotacao_fechamento text,
  fechado_em timestamptz,
  etapa_desde timestamptz not null default now(),
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index negociacoes_resp on negociacoes (responsavel_id, status);
create index negociacoes_funil_etapa on negociacoes (funil_id, etapa_id) where status = 'aberta';

-- =========================================================
-- INTERAÇÕES (timeline)
-- =========================================================
create type tipo_interacao as enum ('ligacao','whatsapp','visita','reuniao','email','anotacao','sistema');

create table interacoes (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  tipo tipo_interacao not null,
  texto text,
  usuario_id uuid references usuarios(id),
  origem_agente boolean not null default false,   -- true quando criado via MCP
  criado_em timestamptz not null default now()
);
create index interacoes_neg on interacoes (negociacao_id, criado_em desc);

-- =========================================================
-- AÇÕES (próximas ações / tarefas)
-- =========================================================
create type tipo_acao as enum ('ligar','whatsapp','visita','reuniao','proposta','outro');

create table acoes (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  descricao text not null,
  tipo tipo_acao not null default 'ligar',
  data date not null,
  hora time,
  responsavel_id uuid not null references usuarios(id),
  concluida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index acoes_pendentes on acoes (responsavel_id, data) where concluida_em is null;

-- =========================================================
-- ORÇAMENTOS
-- =========================================================
create type situacao_orcamento as enum ('enviado','aprovado','recusado','substituido');

create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  numero text,
  valor numeric(14,2) not null,
  enviado_em date not null default current_date,
  validade date,
  arquivo_path text,                 -- Supabase Storage bucket "orcamentos"
  situacao situacao_orcamento not null default 'enviado',
  criado_em timestamptz not null default now()
);

-- =========================================================
-- PRODUTOS E ITENS DE ORÇAMENTO — base criada na entrega 1,
-- telas na entrega 3 (ver seção 8)
-- =========================================================
create table produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                 -- código interno / SKU
  nome text not null,
  descricao text,                     -- texto que sai no orçamento
  linha text,                         -- referencia listas.tipo='linha'
  unidade text not null default 'un', -- un, pç, m, kit, h
  preco_base numeric(14,2) not null default 0,  -- único preço cadastrado; o preço real é editado item a item
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index produtos_nome_trgm on produtos using gin (nome gin_trgm_ops);

create table orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references orcamentos(id) on delete cascade,
  produto_id uuid references produtos(id),     -- nulo permite item livre
  ordem int not null default 0,
  descricao text not null,                     -- copiada do produto, editável
  unidade text not null default 'un',
  quantidade numeric(12,3) not null default 1,
  preco_unitario numeric(14,2) not null,       -- default = produtos.preco_base, sempre editável
  desconto_pct numeric(5,2) not null default 0,
  total numeric(14,2) generated always as (round(quantidade * preco_unitario * (1 - desconto_pct/100), 2)) stored
);
create index orcitens_orc on orcamento_itens (orcamento_id, ordem);

-- Campos extras em orcamentos (adicionar à tabela acima):
alter table orcamentos
  add column origem text not null default 'upload' check (origem in ('upload','gerado')),
  add column titulo text,                           -- "Fornecimento de luminárias LED – Obra X"
  add column condicoes_pagamento text,
  add column prazo_entrega text,
  add column frete text,                            -- CIF / FOB / a combinar
  add column observacoes text,
  add column desconto_geral_pct numeric(5,2) not null default 0,
  add column subtotal numeric(14,2),                -- Σ itens.total, recalculado por trigger
  add column arquivo_pdf_path text,                 -- gerado
  add column arquivo_xlsx_path text;                -- gerado
-- 'numero' passa a ser gerado por sequência quando origem='gerado' (ver 3.4)

-- Dados do emitente (cabeçalho do orçamento), editável em Configurações
create table emitente (
  id int primary key default 1 check (id = 1),
  razao_social text not null,
  cnpj text,
  endereco text,
  telefone text,
  email text,
  site text,
  logo_path text,                                   -- Storage bucket "publico"
  validade_padrao_dias int not null default 15,
  condicoes_pagamento_padrao text,
  prazo_entrega_padrao text,
  rodape text                                       -- texto legal / garantia
);

-- =========================================================
-- API KEYS E LOG (MCP) — entrega 2
-- =========================================================
create table mcp_log (
  id bigint generated always as identity primary key,
  key_id uuid,
  tool text not null,
  args jsonb,
  ok boolean not null,
  erro text,
  ms int,
  criado_em timestamptz not null default now()
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nome text not null,
  key_hash text not null unique,     -- sha256 da key; a key só é exibida uma vez
  criado_em timestamptz not null default now(),
  revogado_em timestamptz
);
```

Extensões necessárias: `pg_trgm`, `unaccent`.

### 3.3 Seed inicial

```sql
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
```

Os valores das listas devem ser confirmados com o diretor antes do seed; usar estes como padrão se não houver resposta.

### 3.4 Triggers e funções

```sql
-- atualizado_em
create or replace function set_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
create trigger trg_emp_upd before update on empresas for each row execute function set_atualizado_em();
create trigger trg_neg_upd before update on negociacoes for each row execute function set_atualizado_em();

-- ao mudar de etapa: reseta etapa_desde e grava interação 'sistema'
create or replace function on_negociacao_etapa_change() returns trigger language plpgsql as $$
declare v_de text; v_para text;
begin
  if new.etapa_id is distinct from old.etapa_id then
    new.etapa_desde = now();
    select nome into v_de from etapas where id = old.etapa_id;
    select nome into v_para from etapas where id = new.etapa_id;
    insert into interacoes (negociacao_id, tipo, texto, usuario_id)
    values (new.id, 'sistema', format('Moveu de "%s" para "%s"', v_de, v_para), auth.uid());
  end if;
  if new.status is distinct from old.status then
    insert into interacoes (negociacao_id, tipo, texto, usuario_id)
    values (new.id, 'sistema',
      case new.status when 'vendida' then format('Marcada como vendida: R$ %s', new.valor_final)
                      when 'perdida' then format('Marcada como perdida: %s', new.motivo_perda)
                      else 'Reaberta' end, auth.uid());
  end if;
  return new;
end $$;
create trigger trg_neg_etapa before update on negociacoes for each row execute function on_negociacao_etapa_change();

-- subtotal e valor do orçamento gerado recalculados a partir dos itens
create or replace function recalc_orcamento(p_id uuid) returns void language plpgsql as $$
declare v_sub numeric(14,2); v_desc numeric(5,2);
begin
  select coalesce(sum(total),0) into v_sub from orcamento_itens where orcamento_id = p_id;
  select desconto_geral_pct into v_desc from orcamentos where id = p_id;
  update orcamentos set subtotal = v_sub, valor = round(v_sub * (1 - coalesce(v_desc,0)/100), 2)
  where id = p_id and origem = 'gerado';
end $$;

create or replace function trg_orcitens_recalc() returns trigger language plpgsql as $$
begin perform recalc_orcamento(coalesce(new.orcamento_id, old.orcamento_id)); return null; end $$;
create trigger trg_orcitens after insert or update or delete on orcamento_itens
  for each row execute function trg_orcitens_recalc();

-- numeração sequencial ORC-2026-0001 para orçamentos gerados
create or replace function proximo_numero_orcamento() returns text language plpgsql as $$
declare n int; p text;
begin
  update config set valor = (valor::int + 1)::text where chave = 'orcamento_proximo_numero' returning (valor::int - 1) into n;
  select valor into p from config where chave = 'orcamento_prefixo';
  return format('%s-%s-%s', p, to_char(now(), 'YYYY'), lpad(n::text, 4, '0'));
end $$;

-- helper: perfil do usuário logado
create or replace function eh_diretor() returns boolean language sql stable as $$
  select exists (select 1 from usuarios where id = auth.uid() and perfil = 'diretor' and ativo);
$$;
```

### 3.5 RLS

Habilitar RLS em todas as tabelas. Políticas:

```sql
-- usuarios: todos leem (para mostrar nomes); só diretor escreve
create policy usuarios_sel on usuarios for select using (true);
create policy usuarios_mod on usuarios for all using (eh_diretor());

-- funis, etapas, listas, config: todos leem, diretor escreve
-- (repetir o padrão abaixo para as quatro tabelas)
create policy funis_sel on funis for select using (true);
create policy funis_mod on funis for all using (eh_diretor());

-- empresas e contatos: todos leem; escreve se diretor, ou responsável, ou sem responsável
create policy empresas_sel on empresas for select using (true);
create policy empresas_ins on empresas for insert with check (true);
create policy empresas_upd on empresas for update
  using (eh_diretor() or responsavel_id = auth.uid() or responsavel_id is null);

create policy contatos_sel on contatos for select using (true);
create policy contatos_ins on contatos for insert with check (true);
create policy contatos_upd on contatos for update using (
  eh_diretor() or exists (select 1 from empresas e where e.id = empresa_id and (e.responsavel_id = auth.uid() or e.responsavel_id is null))
);

-- negociacoes: diretor tudo; vendedor só as suas
create policy neg_all on negociacoes for all
  using (eh_diretor() or responsavel_id = auth.uid())
  with check (eh_diretor() or responsavel_id = auth.uid());

-- interacoes, acoes, orcamentos: seguem a negociação
create policy inter_all on interacoes for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id and (eh_diretor() or n.responsavel_id = auth.uid()))
);
-- repetir para acoes e orcamentos

-- produtos e emitente: todos leem, diretor escreve
create policy produtos_sel on produtos for select using (true);
create policy produtos_mod on produtos for all using (eh_diretor());
create policy emitente_sel on emitente for select using (true);
create policy emitente_mod on emitente for all using (eh_diretor());

-- orcamento_itens: segue o orçamento → negociação
create policy orcitens_all on orcamento_itens for all using (
  exists (select 1 from orcamentos o join negociacoes n on n.id = o.negociacao_id
          where o.id = orcamento_id and (eh_diretor() or n.responsavel_id = auth.uid()))
);

-- api_keys: cada um vê as suas; diretor vê todas
create policy keys_all on api_keys for all using (eh_diretor() or usuario_id = auth.uid());
```

Storage: bucket `orcamentos`, privado. Policy: leitura/escrita se o usuário tem acesso à negociação (path `negociacao_id/<orcamento_id>.pdf` e `.xlsx`). Bucket `publico` (logo do emitente), leitura pública, escrita só diretor.

### 3.6 Views para relatórios

Todas as views são `security_invoker = true` para respeitar RLS.

```sql
-- Negociações enriquecidas (base do kanban, listas e alertas)
create view v_negociacoes with (security_invoker = true) as
select
  n.*,
  e.nome as empresa_nome, e.cidade as empresa_cidade,
  et.nome as etapa_nome, et.ordem as etapa_ordem, f.nome as funil_nome,
  u.nome as responsavel_nome,
  (current_date - n.etapa_desde::date) as dias_na_etapa,
  (select max(i.criado_em) from interacoes i where i.negociacao_id = n.id and i.tipo <> 'sistema') as ultima_interacao,
  (current_date - coalesce((select max(i.criado_em) from interacoes i where i.negociacao_id = n.id and i.tipo <> 'sistema'), n.criado_em)::date) as dias_sem_interacao,
  ((current_date - coalesce((select max(i.criado_em) from interacoes i where i.negociacao_id = n.id and i.tipo <> 'sistema'), n.criado_em)::date)
     >= (select valor::int from config where chave = 'dias_parada_negociacao')) as parada,
  (select min(a.data) from acoes a where a.negociacao_id = n.id and a.concluida_em is null) as proxima_acao_data,
  (select a.descricao from acoes a where a.negociacao_id = n.id and a.concluida_em is null order by a.data, a.hora nulls last limit 1) as proxima_acao_descricao,
  exists (select 1 from acoes a where a.negociacao_id = n.id and a.concluida_em is null and a.data < current_date) as acao_atrasada,
  not exists (select 1 from acoes a where a.negociacao_id = n.id and a.concluida_em is null) as sem_acao
from negociacoes n
join empresas e on e.id = n.empresa_id
join etapas et on et.id = n.etapa_id
join funis f on f.id = n.funil_id
join usuarios u on u.id = n.responsavel_id
where n.arquivado_em is null;

-- Resultado por mês e responsável
create view v_resultado_mensal with (security_invoker = true) as
select
  date_trunc('month', fechado_em)::date as mes,
  responsavel_id,
  sum(valor_final) filter (where status = 'vendida') as vendido,
  count(*) filter (where status = 'vendida') as qtd_vendida,
  sum(valor_estimado) filter (where status = 'perdida') as perdido,
  count(*) filter (where status = 'perdida') as qtd_perdida,
  avg(valor_final) filter (where status = 'vendida') as ticket_medio,
  avg(extract(day from fechado_em - criado_em)) filter (where status = 'vendida') as ciclo_dias
from negociacoes
where status in ('vendida','perdida') and arquivado_em is null
group by 1, 2;

-- Previsão por mês
create view v_previsao with (security_invoker = true) as
with pesos as (
  select
    (select valor::numeric from config where chave='peso_fria') as fria,
    (select valor::numeric from config where chave='peso_morna') as morna,
    (select valor::numeric from config where chave='peso_quente') as quente
)
select
  coalesce(n.previsao_mes, date_trunc('month', current_date + interval '1 month')::date) as mes,
  n.responsavel_id,
  sum(n.valor_estimado) as aberto,
  sum(n.valor_estimado * case n.temperatura when 1 then p.fria when 2 then p.morna else p.quente end) as realista,
  sum(n.valor_estimado) filter (where n.temperatura >= 2) as otimista,
  count(*) as qtd
from negociacoes n, pesos p
where n.status = 'aberta' and n.arquivado_em is null
group by 1, 2;

-- Funil: valor e quantidade por etapa
create view v_funil with (security_invoker = true) as
select f.id as funil_id, f.nome as funil, et.id as etapa_id, et.nome as etapa, et.ordem,
  count(n.id) as qtd, coalesce(sum(n.valor_estimado),0) as valor
from funis f
join etapas et on et.funil_id = f.id and et.ativo
left join negociacoes n on n.etapa_id = et.id and n.status = 'aberta' and n.arquivado_em is null
where f.ativo
group by 1,2,3,4,5;

-- Motivos de perda
create view v_motivos_perda with (security_invoker = true) as
select date_trunc('month', fechado_em)::date as mes, responsavel_id, linha, motivo_perda,
  count(*) as qtd, sum(valor_estimado) as valor
from negociacoes where status = 'perdida' and arquivado_em is null
group by 1,2,3,4;
```

**Função do relatório da presidência** (retorna JSON; a página só renderiza):

```sql
create or replace function relatorio_presidencia(p_mes date default date_trunc('month', current_date)::date)
returns jsonb language sql stable security invoker as $$
with
  atual as (select coalesce(sum(vendido),0) v, coalesce(sum(qtd_vendida),0) q, coalesce(sum(perdido),0) p, coalesce(sum(qtd_perdida),0) pq
            from v_resultado_mensal where mes = p_mes),
  anterior as (select coalesce(sum(vendido),0) v from v_resultado_mensal where mes = p_mes - interval '1 month'),
  prev as (select mes, sum(aberto) aberto, sum(realista) realista, sum(otimista) otimista
           from v_previsao where mes >= p_mes and mes < p_mes + interval '3 month' group by mes order by mes),
  top10 as (select empresa_nome, titulo, valor_estimado, etapa_nome, proxima_acao_descricao, proxima_acao_data, responsavel_nome
            from v_negociacoes where status='aberta' order by valor_estimado desc limit 10),
  perdas as (select motivo_perda, sum(qtd) qtd, sum(valor) valor from v_motivos_perda where mes = p_mes group by 1)
select jsonb_build_object(
  'mes', p_mes,
  'vendido', (select v from atual),
  'qtd_vendida', (select q from atual),
  'ticket_medio', (select case when q>0 then round(v/q, 2) else 0 end from atual),
  'vendido_mes_anterior', (select v from anterior),
  'variacao_pct', (select case when (select v from anterior)>0 then round(((select v from atual)/(select v from anterior)-1)*100,1) else null end),
  'perdido', (select p from atual),
  'qtd_perdida', (select pq from atual),
  'conversao_pct', (select case when q+pq>0 then round(q::numeric/(q+pq)*100,1) else null end from atual),
  'previsao', (select jsonb_agg(row_to_json(prev)) from prev),
  'top_negociacoes', (select jsonb_agg(row_to_json(top10)) from top10),
  'perdas', (select jsonb_agg(row_to_json(perdas)) from perdas)
);
$$;
```

---

### 3.7 Multi-empresa (empresas vendedoras) — migration 0008

O CRM atende várias empresas do grupo que vendem para os mesmos clientes.

- `emitentes` (evolução da antiga `emitente` singleton): `id uuid`, `nome`, `razao_social`, `cnpj`, `endereco`, `telefone`, `email`, `site`, `logo_path`, `validade_padrao_dias`, `condicoes_pagamento_padrao`, `prazo_entrega_padrao`, `rodape`, `orcamento_prefixo`, `orcamento_proximo_numero`, `ordem`, `ativo`. Numeração de orçamento por empresa: `proximo_numero_orcamento(p_emitente uuid)`.
- `usuario_emitentes (usuario_id, emitente_id, perfil perfil_usuario, gerente_id)`: **o perfil é por empresa**. `usuarios.perfil` vira só o padrão do convite. Helpers `security definer`: `eh_membro_de(uuid)`, `eh_diretor_de(uuid)`, `eh_gerente_de(usuario, emitente)`, `minhas_empresas()`; `eh_diretor()` passa a significar "diretor em alguma empresa" (recursos globais: funis, etapas, listas, config, usuários, clientes).
- `negociacoes.emitente_id`, `produtos.emitente_id`, `metas.emitente_id` (not null). `produtos.codigo` único por empresa. `metas` únicas por (responsável, empresa, mês).
- `categorias_produto (emitente_id, nome, descricao, catalogo_path, catalogo_url, ordem, ativo)`; `produtos.categoria_id`, `produtos.link` (página no site), `produtos.catalogo_path` / `catalogo_url`. Catálogos e logos ficam no bucket público `publico` em `emitentes/<id>/...` (escrita só pelo diretor da empresa).
- RLS: negociações e dependentes = diretor da empresa, responsável ou gerente do responsável naquela empresa; `with check` exige que o responsável seja membro da empresa. Produtos, categorias e metas: membros leem, diretor da empresa escreve. `api_keys`/`mcp_log`: diretor vê só das pessoas das empresas que dirige. Clientes e contatos continuam globais.
- Views `v_negociacoes` (+`emitente_id`, `emitente_nome`), `v_resultado_mensal`, `v_previsao`, `v_funil`, `v_motivos_perda` ganham `emitente_id` (uma linha por empresa; o app soma quando o escopo é "Todas"). `relatorio_presidencia(p_mes, p_emitente default null)`.
- Escopo na UI: cookie `crm_emitente` ("todas" ou id) com override `?emitente=`; um núcleo puro (`lib/auth/escopo-empresa-core.ts`) serve páginas, `/api/exportar` e MCP (argumento `empresa_vendedora`).
- Migration `0009` (após o deploy): remove `emitente`, os defaults de `emitente_id`, `usuarios.gerente_id` e as chaves `config.orcamento_*`.

## 4. Regras de negócio

| # | Regra | Onde implementar |
|---|---|---|
| R1 | Criar negociação exige: `empresa_id`, `valor_estimado` (pode ser 0), `funil_id`. `etapa_id` default = primeira etapa do funil. `responsavel_id` default = usuário logado. `titulo` sugerido = `[linha] nome_da_empresa` (editável). `temperatura` default 2. `previsao_mes` default = mês atual + 1. | Server Action `criarNegociacao` |
| R2 | Ao criar negociação, o formulário pede uma **próxima ação** (descrição + data). Pode pular; se pular, negociação fica com flag `sem_acao`. | Formulário |
| R3 | Mudar `etapa_id`: trigger grava interação `sistema` e reseta `etapa_desde`. Se a negociação não tiver ação pendente após mover, UI abre o mini-form "Próxima ação?". | Trigger + UI |
| R4 | Concluir ação: seta `concluida_em`; UI abre mini-form "Próxima ação?" com atalhos de data (amanhã, +3 dias, próxima semana). | Server Action `concluirAcao` |
| R5 | Registrar interação de um toque: insere `interacoes` com `tipo` e `texto` opcional. Botões: Liguei, WhatsApp, Visitei, Reunião. | Server Action `registrarInteracao` |
| R6 | Criar orçamento (upload ou gerado): se a etapa atual tem `ordem` menor que a primeira etapa do funil com `conta_como_proposta = true`, move a negociação para essa etapa. Oferece atualizar `valor_estimado` com o valor do orçamento (checkbox marcado por padrão). Orçamentos anteriores da mesma negociação com `situacao = 'enviado'` passam para `substituido`. | Server Action `criarOrcamento` |
| R6a | Orçamento gerado (`origem='gerado'`): `numero` vem de `proximo_numero_orcamento()`; `valor` e `subtotal` são calculados pelos itens (trigger), nunca digitados; `preco_unitario` de cada item nasce igual a `produtos.preco_base` e é sempre editável; item sem `produto_id` é permitido (item livre). Ao gerar o PDF/Excel, os arquivos são salvos no Storage e os paths gravados. Alterar um item após gerar exige "Gerar novamente" (arquivos antigos são sobrescritos). | Server Actions `salvarItens`, `gerarArquivosOrcamento` |
| R7 | Marcar venda: exige `valor_final` (default `valor_estimado`) e `previsao_mes` (default mês atual, vira o mês da venda). Seta `status='vendida'`, `fechado_em=now()`, conclui todas as ações abertas, orçamento mais recente → `aprovado`. | Server Action `marcarVenda` |
| R8 | Marcar perda: exige `motivo_perda` (da lista) e aceita `anotacao_fechamento`. Seta `status='perdida'`, `fechado_em=now()`, conclui ações abertas, orçamento mais recente → `recusado`. | Server Action `marcarPerda` |
| R9 | Reabrir: só diretor ou responsável. Volta `status='aberta'`, limpa `fechado_em`, mantém etapa. | Server Action `reabrir` |
| R10 | Alertas no cartão (calculados em `v_negociacoes`): `acao_atrasada` (vermelho), `sem_acao` (amarelo), `dias_sem_interacao >= config.dias_parada_negociacao` (cinza "parada"). | View + UI |
| R11 | Empresa: nome único (case/acento-insensitive). Ao digitar no cadastro, autocomplete busca por trigram; se já existir, seleciona em vez de criar. | Índice + UI |
| R12 | Vendedor só vê/edita negociações onde `responsavel_id = auth.uid()`. Diretor vê tudo e pode transferir (`responsavel_id`). | RLS |
| R13 | Toda escrita via MCP grava `interacoes.origem_agente = true` e prefixa `texto` com `[agente]`. | MCP |
| R15 | Toda negociação pertence a uma **empresa vendedora** (`emitente_id`), escolhida na criação (pré-selecionada pelo escopo); só membros da empresa criam nela e o responsável precisa ser membro. Não se troca a empresa de uma negociação (cria-se outra). | Server Action `criarNegociacao`, MCP, RLS |
| R16 | Produto, categoria e meta pertencem a uma empresa vendedora; o orçamento só aceita produtos do catálogo da empresa da negociação (item livre continua permitido). | `criarOrcamentoGerado`, `adicionarItemOrcamento` |
| R17 | Perfil por empresa: diretor de A não tem poder em B. Recursos globais (funis, listas, parâmetros, usuários, clientes, importação) exigem ser diretor em alguma empresa; recursos da empresa exigem ser diretor dela. | `perfilEm`, `exigirDiretorDe`, RLS |
| R18 | Todo relatório, dashboard, listagem, exportação e tool MCP respeita o escopo (uma empresa ou todas). "Todas" = sem filtro (a RLS limita às empresas do usuário). | `getEscopoEmpresa`, `aplicarEscopoEmitente` |
| R14 | Excluir: o padrão é arquivar (`arquivado_em`). Diretor pode arquivar qualquer coisa; vendedor só o que é seu. Arquivados somem de todas as telas e views. Exclusão definitiva (delete físico, com cascade em interações, ações, orçamentos e arquivos do Storage) só pelo diretor, com confirmação na ficha. | Server Actions |

---

## 5. Telas e critérios de aceite

Rotas do App Router. Layout: sidebar no desktop (≥ 1024px), barra inferior no mobile com Hoje · Funil · Empresas · Mais.

### 5.1 `/login`
Supabase Auth com e-mail + senha (magic link opcional). Sem cadastro público; o diretor cria usuários em Configurações (função server-side com service role, envia convite por e-mail).

**Aceite:** usuário inativo não entra. Após login, redireciona para `/hoje`.

### 5.2 `/hoje` (tela inicial)
Blocos, nesta ordem:
1. Três números: **Aberto** (Σ valor_estimado abertas), **Vendido no mês**, **Perdido no mês**. Diretor vê consolidado com seletor de vendedor (default "Todos").
2. **Ações atrasadas** (data < hoje) e **de hoje**, agrupadas. Cada linha: descrição, empresa, tipo, data; botões **Concluir** (abre mini-form próxima ação) e **Adiar 1 dia**.
3. **Negociações sem próxima ação** (flag `sem_acao`), com botão "Definir ação".
4. **Orçamentos vencendo** em até `config.alerta_validade_orcamento_dias` dias.
5. Botão flutuante **+ Negociação**.

**Aceite:** concluir uma ação sem definir a próxima faz a negociação aparecer no bloco 3 imediatamente. Tudo utilizável em 390px.

### 5.3 `/funil` (kanban)
- Seletor de funil (default: primeiro ativo). Filtros: vendedor (só diretor), linha, temperatura, texto.
- Uma coluna por etapa ativa, na ordem. Cabeçalho da coluna: nome, quantidade, Σ valor.
- Cartão: título, empresa, valor, temperatura (ícone 1–3), `dias_na_etapa`, próxima ação com data (vermelha se atrasada), badges de alerta (R10). Três botões pequenos: Liguei / WhatsApp / Visitei (R5, sem abrir a negociação).
- Desktop: arrastar entre colunas (`@dnd-kit`). Mobile: menu "Mover para…".
- Toggle para visão em lista (tabela com as mesmas colunas, ordenável por valor, dias, próxima ação).

**Aceite:** mover cartão atualiza a coluna e grava interação `sistema`. Se ficar sem ação pendente, abre mini-form (R3). Soma da coluna bate com `v_funil`.

### 5.4 `/negociacoes/[id]`
- Cabeçalho: título (editável inline), empresa (link), valor (editável), temperatura (3 botões), responsável, linha, origem, previsão (seletor de mês). Barra de etapas do funil clicável.
- Botões grandes: **Marcar venda** · **Marcar perda** (modais R7/R8). Se fechada: badge de status + botão Reabrir.
- **Próxima ação** em destaque com Concluir / Adiar / Editar; botão "+ Ação".
- Barra de registro rápido: Liguei · WhatsApp · Visitei · Reunião · Anotação (campo de texto opcional que aparece ao tocar).
- **Timeline** única, ordem decrescente: interações, ações concluídas, orçamentos, eventos de sistema.
- Lateral (desktop) / abaixo (mobile): contato principal com link `https://wa.me/<whatsapp>`, seletor para trocar/adicionar contato; lista de orçamentos com "+ Orçamento" (valor, data, validade, PDF); arquivos.

**Aceite:** todo campo editável salva ao perder o foco, sem botão "Salvar" global. Criar orçamento move etapa conforme R6.

### 5.5 `/negociacoes/nova` (ou modal)
Campos, nesta ordem: Empresa (autocomplete R11, com "+ Nova empresa" inline: nome, cidade, segmento), Valor aproximado, Funil (default primeiro), Linha, Próxima ação (descrição + data com atalhos). Título é sugerido e escondido em "mais detalhes" junto com origem, temperatura, previsão, contato.

**Aceite:** possível criar com 3 toques além da digitação: empresa, valor, salvar.

### 5.6 `/empresas` e `/empresas/[id]`
- Lista: nome, cidade, segmento, responsável, negociações abertas (qtd), último contato. Ordenável; default por último contato ascendente (abandonadas primeiro). Busca por nome.
- Página: 7 indicadores (aberto, vendido, perdido, qtd negociações, ticket médio, ciclo médio, último contato); negociações (abertas primeiro); contatos (+ Contato); timeline consolidada de todas as negociações; botão "+ Negociação" já com a empresa.

### 5.7 `/contatos`
Lista com busca: nome, empresa, cargo, WhatsApp (link), decisor. Criar/editar. Secundária; sem exigências além de funcionar.

### 5.8 `/relatorios`
Filtros globais no topo: período (mês, trimestre, personalizado), vendedor (diretor), linha, origem. Abas:
1. **Presidência** (default): renderiza `relatorio_presidencia(mes)`. Layout imprimível (A4, `@media print`), botão "Imprimir / PDF" e botão "Copiar como texto" (gera texto simples para WhatsApp, formato na seção 5.9). Campo "Comentário do diretor" (textarea, salvo em `config` com chave `comentario_<mes>`).
2. **Funil**: `v_funil` por funil, barras horizontais por etapa com qtd e valor.
3. **Previsão**: `v_previsao` 6 meses, tabela aberto / realista / otimista.
4. **Ranking** (só diretor): por vendedor: vendido, qtd, aberto, conversão, interações no período, % negociações com ação, ações atrasadas.
5. **Perdas**: `v_motivos_perda` tabela e barra.
6. **Carteira parada**: `v_negociacoes` onde `dias_sem_interacao >= config` ordenado por valor; empresas sem contato há `dias_parada_empresa`.

Todas as abas: botão "Exportar CSV".

**Aceite:** vendedor abrindo `/relatorios` vê só os próprios dados (RLS garante); aba Ranking não aparece. Números da aba Presidência batem com `v_resultado_mensal` e `v_previsao` no SQL Editor.

### 5.9 Formato "Copiar como texto" (WhatsApp)

```
*F-Led · Vendas e previsão*
Setembro/2026 · até 11/09

*Resultado do mês*
Vendido: R$ 1,84 mi (+12% vs. agosto) · 7 negócios · ticket R$ 263 mil
Perdido: R$ 610 mil (3) · Conversão: 41%

*Previsão de fechamento*
Set (restante): R$ 1,2 mi realista / R$ 1,9 mi otimista
Out: R$ 2,0 mi / R$ 3,3 mi
Nov: R$ 0,9 mi / R$ 1,6 mi

*Maiores negociações em andamento*
• Remo Engenharia – R$ 1,14 mi – Negociação final – reunião 16/09
• KPL Instalações – R$ 891 mil – Proposta enviada – aguardando comprador
• Economart – R$ 420 mil – Interesse – orçamento até 18/09

*Perdas do mês*
Preço (2), Projeto cancelado (1)

*Comentário*
<texto do diretor>
```

Valores: até R$ 999.999 → `R$ 891 mil`; a partir de 1 milhão → `R$ 1,14 mi`.

### 5.10 `/configuracoes` (só diretor)
- **Funis e etapas:** CRUD, reordenar (drag), ativar/desativar, `dica`, `conta_como_proposta`. Não permite excluir etapa com negociações abertas; oferece mover para outra etapa.
- **Listas:** CRUD por tipo.
- **Parâmetros:** dias de parada, pesos da previsão, dias de alerta de validade.
- **Usuários:** convidar por e-mail, perfil, ativar/desativar.
- **API keys** (entrega 2): gerar (mostra uma vez), revogar.
- **Importar CSV** (ver seção 6).

---

## 6. Importação CSV (entrega 1, segunda-feira)

Página em Configurações, três uploads separados, nesta ordem. Encoding UTF-8 ou Latin-1 (detectar). Separador `,` ou `;` (detectar). Mostrar prévia das 5 primeiras linhas com mapeamento de colunas antes de importar.

**empresas.csv:** `nome*, cidade, uf, segmento, cnpj, responsavel_email, observacoes`
**contatos.csv:** `empresa_nome*, nome*, whatsapp, email, cargo`
**negociacoes.csv:** `empresa_nome*, titulo, valor_estimado, funil_nome, etapa_nome, linha, origem, responsavel_email, status (aberta|vendida|perdida), valor_final, motivo_perda, criado_em (dd/mm/aaaa), fechado_em, proxima_acao, proxima_acao_data`

Regras: empresa por nome (R11) — se existir, reutiliza. Funil/etapa por nome; se não bater, usa o primeiro funil e primeira etapa e marca a linha no relatório de importação. `responsavel_email` inexistente → usuário logado. Ao final, relatório: importadas, reutilizadas, erros (com linha e motivo). Importação é transacional por arquivo.

---

## 6A. Geração automática de orçamento (base na entrega 1, telas na entrega 3)

### 6A.1 O que fica pronto já na entrega 1
- Tabelas `produtos`, `orcamento_itens`, `emitente` e colunas novas em `orcamentos` (seção 3.2), triggers de recálculo e numeração (3.4), RLS (3.5).
- Cadastro de produtos em `/configuracoes/produtos` (CRUD simples: código, nome, descrição, linha, unidade, preço base, ativo) e importação CSV `produtos.csv` (`codigo, nome, descricao, linha, unidade, preco_base`).
- Cadastro do emitente em `/configuracoes/emitente`.
- No modal "+ Orçamento" da negociação, dois caminhos: **Anexar PDF** (fluxo atual, `origem='upload'`) e **Montar orçamento** (desabilitado com aviso "em breve" até a entrega 3).

### 6A.2 Fluxo na entrega 3
1. Em `/negociacoes/[id]`, "+ Orçamento → Montar orçamento" cria `orcamentos` com `origem='gerado'`, `numero` sequencial, `titulo` sugerido = título da negociação, `validade` = hoje + `emitente.validade_padrao_dias`, condições e prazo copiados dos padrões do emitente.
2. Tela `/orcamentos/[id]` (editor):
   - Cabeçalho: cliente (empresa + contato, com CNPJ/endereço da empresa), número, data, validade, título.
   - Tabela de itens editável em linha: busca de produto (autocomplete por nome/código), descrição, unidade, quantidade, preço unitário (pré-preenchido com `preco_base`, editável), desconto %, total. Botão "+ Item" e "+ Item livre". Reordenar por arrastar.
   - Rodapé: subtotal, desconto geral %, **total**; condições de pagamento, prazo de entrega, frete, observações.
   - Botões: **Gerar PDF**, **Gerar Excel**, **Marcar como enviado** (seta `enviado_em`, aplica R6), Duplicar (nova versão: mesmo conteúdo, número novo, anterior → `substituido`).
3. O PDF segue o **modelo de orçamento anexo à especificação** (cabeçalho com logo e dados do emitente, dados do cliente, tabela de itens, totais, condições, rodapé legal). O desenvolvedor deve reproduzir o layout do modelo; onde o modelo tiver campo que não existe aqui, avisar antes de improvisar.
4. O Excel tem duas abas: **Orçamento** (mesmo layout do PDF, com fórmulas vivas em quantidade × preço × desconto e nos totais, para o cliente ou o vendedor simular) e **Itens** (tabela plana para importar em outro sistema).
5. Nome dos arquivos: `ORC-2026-0001_<empresa-slug>.pdf` / `.xlsx`. Botão "Enviar por WhatsApp" abre `wa.me` do contato com texto padrão + link assinado do PDF (validade 7 dias).

### 6A.3 Premissa de preço
O cadastro de produto tem **um único preço base**. Como há muitas variações de preço (volume, região, cliente, licitação), o preço real é decidido item a item no orçamento. Não implementar tabelas de preço, faixas ou regras de desconto automático sem nova especificação. Guardar sempre o `preco_base` da época em `orcamento_itens` não é necessário: o `preco_unitario` gravado já é o preço praticado.

### 6A.4 Aceite
- Orçamento com 20 itens gera PDF em menos de 5 s.
- Total do PDF, do Excel e da tela são idênticos ao centavo.
- Vendedor só abre orçamentos das próprias negociações.

---

## 6B. Exportação para Excel em qualquer tela (base na entrega 1, botões na entrega 2)

### 6B.1 Base (entrega 1)
Módulo único `lib/excel.ts` com a função:

```ts
export async function exportarExcel(opts: {
  nomeArquivo: string;              // sem extensão
  titulo: string;                   // linha 1 da planilha
  filtros?: Record<string, string>; // linha 2: "Período: set/2026 · Vendedor: Todos"
  colunas: { chave: string; titulo: string; tipo?: 'texto'|'moeda'|'inteiro'|'data'|'percentual' }[];
  linhas: Record<string, unknown>[];
}): Promise<Buffer>
```
Regras: cabeçalho em negrito com filtro automático e painel congelado; moeda em `R$ #.##0,00`; datas como data real (não texto); largura de coluna automática; linha de total ao final para colunas moeda/inteiro; nome do arquivo `<nome>_<aaaa-mm-dd>.xlsx`.

Route handler genérico `GET /api/exportar?tela=<id>&<filtros>` que resolve a mesma consulta da tela (mesmo RLS do usuário logado) e responde o `.xlsx`. Cada tela registra sua consulta em `lib/exportacoes.ts` (`{ id, titulo, colunas, query(filtros, supabase) }`).

### 6B.2 Botões (entrega 2)
Botão "Exportar Excel" no canto superior direito de: Funil (visão lista), Empresas, Contatos, Tarefas/Hoje, cada aba de Relatórios, Produtos, Orçamento (itens). O botão sempre exporta **o que está filtrado na tela**, todas as páginas (sem paginação), respeitando RLS.

### 6B.3 Aceite
Exportar 2.000 linhas em menos de 5 s. Abrir no Excel sem aviso de reparo. Valores monetários somáveis (não texto).

---

## 7. Integração MCP (entrega 2)

### 7.1 Transporte e autenticação
- Endpoint `/api/mcp/[transport]` (Streamable HTTP) usando `@modelcontextprotocol/sdk` + `mcp-handler`. URL final para os clientes: `https://<dominio>/api/mcp/mcp`.
- Header `Authorization: Bearer <api_key>`. A key é gerada em Configurações (32 bytes random, base64url), armazenada como sha256 em `api_keys.key_hash`.
- **Como fazer as RLS valerem para o dono da key:** resolver `usuario_id` com o service role; em seguida assinar um JWT do Supabase para esse usuário (`{ sub: usuario_id, role: 'authenticated', aud: 'authenticated', exp: now+5min }`, assinado com `SUPABASE_JWT_SECRET` via `jose`) e criar um client **anon** com esse token no header `Authorization`. Assim `auth.uid()` retorna o dono da key e todas as políticas da seção 3.5 se aplicam sem código extra. Não usar service role para as operações das tools.
- Implementação do transporte em Next.js: usar o pacote **`mcp-handler`** (adapter oficial da Vercel para Next.js App Router), que expõe `createMcpHandler(server => {...})` e devolve os handlers `GET/POST/DELETE` de `app/api/mcp/[transport]/route.ts`. Ele já implementa Streamable HTTP; não escrever transporte à mão.
- Rate limit: 60 chamadas/min por key. Log de cada chamada em tabela `mcp_log (key_id, tool, args jsonb, ok, ms, criado_em)`.

### 7.2 Tools

| Tool | Args (zod) | Retorno |
|---|---|---|
| `buscar_empresa` | `{ texto: string }` | até 10 empresas: id, nome, cidade, negociações abertas |
| `criar_empresa` | `{ nome, cidade?, uf?, segmento?, contato?: { nome, whatsapp?, cargo? } }` | empresa (criada ou existente) + contato |
| `listar_negociacoes` | `{ status?, funil?, etapa?, responsavel_email?, parada_ha_dias?, limite? }` | linhas de `v_negociacoes` |
| `obter_negociacao` | `{ id }` | ficha completa + timeline + ações + orçamentos |
| `criar_negociacao` | `{ empresa_id \| empresa_nome, valor_estimado, funil?, linha?, origem?, temperatura?, previsao_mes?, proxima_acao?: { descricao, data, tipo? } }` | negociação criada |
| `registrar_interacao` | `{ negociacao_id, tipo, texto? }` | ok |
| `criar_acao` | `{ negociacao_id, descricao, data, tipo?, hora? }` | ação criada |
| `concluir_acao` | `{ acao_id, proxima?: { descricao, data } }` | ok |
| `mover_etapa` | `{ negociacao_id, etapa: string (nome ou id) }` | ok |
| `fechar_negociacao` | `{ negociacao_id, resultado: 'vendida'\|'perdida', valor_final?, motivo?, anotacao? }` | ok |
| `relatorio_presidencia` | `{ mes?: 'YYYY-MM' }` | JSON da função SQL |
| `previsao` | `{ meses?: number }` | linhas de `v_previsao` |
| `buscar_produto` | `{ texto: string }` | até 10 produtos: id, código, nome, unidade, preço base |
| `montar_orcamento` (entrega 3) | `{ negociacao_id, itens: [{ produto_id \| descricao, quantidade, preco_unitario?, desconto_pct? }], condicoes_pagamento?, prazo_entrega?, observacoes? }` | orçamento criado (rascunho, não enviado) com número e total; o vendedor revisa e gera os arquivos na tela |

### 7.3 Resources
- `crm://funis` → funis e etapas ativas (JSON).
- `crm://listas` → listas por tipo.
- `crm://negociacao/{id}` → mesmo que `obter_negociacao`.

### 7.4 Guardrails
- Tools de escrita retornam texto confirmando empresa e valor ("Criada negociação para Remo Engenharia, R$ 1.140.000, funil Prospecção").
- `fechar_negociacao` não aceita lote.
- Toda escrita grava interação com `origem_agente = true` (R13).
- Key revogada → 401.

### 7.5 Esqueleto

```ts
// app/api/mcp/route.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { clientForApiKey } from "@/lib/mcp-auth";
import { toNextHandlers } from "@/lib/mcp-transport";

const server = new McpServer({ name: "crm-fled", version: "1.0.0" });

server.tool(
  "registrar_interacao",
  { negociacao_id: z.string().uuid(),
    tipo: z.enum(["ligacao","whatsapp","visita","reuniao","email","anotacao"]),
    texto: z.string().optional() },
  async (args, ctx) => {
    const { supabase, user } = await clientForApiKey(ctx);
    const { error } = await supabase.from("interacoes").insert({
      ...args, texto: `[agente] ${args.texto ?? ""}`.trim(),
      usuario_id: user.id, origem_agente: true });
    if (error) throw new Error(error.message);
    return { content: [{ type: "text", text: "Interação registrada." }] };
  }
);

// ...demais tools

export const { GET, POST } = toNextHandlers(server);
```

`clientForApiKey` e `toNextHandlers` são funções a implementar conforme 7.1 (`lib/mcp-auth.ts` e o `createMcpHandler` do `mcp-handler`); os nomes acima são ilustrativos.

Configuração no cliente (Cursor / Claude Desktop):
```json
{ "mcpServers": { "crm-fled": { "url": "https://<dominio>/api/mcp", "headers": { "Authorization": "Bearer <api_key>" } } } }
```

---

## 8. Plano de entrega

### Entrega 1 — segunda 14/09 (obrigatório para a terça)
- [ ] Projeto Supabase criado; migrations 3.2–3.6 aplicadas; seed 3.3; RLS testado com um usuário de cada perfil.
- [ ] Login; criação de usuários pelo diretor.
- [ ] `/hoje`, `/funil` (kanban + lista), `/negociacoes/[id]`, `/negociacoes/nova`, `/empresas`, `/empresas/[id]`, `/contatos`.
- [ ] Regras R1–R12, R14.
- [ ] `/relatorios` aba Presidência (tela + imprimir + copiar texto) e aba Funil.
- [ ] `/configuracoes`: funis/etapas, listas, parâmetros, usuários, importação CSV, **produtos** e **emitente** (6A.1).
- [ ] Base de orçamento e exportação pronta: tabelas de 6A, `lib/excel.ts` e `/api/exportar` (6B.1), sem botões nas telas ainda.
- [ ] Base real importada; diretor e Levy com acesso; 10 negociações de teste validadas.
- [ ] Deploy em produção com domínio.

### Entrega 2 — sexta 25/09
- [ ] `/relatorios`: Previsão, Ranking, Perdas, Carteira parada.
- [ ] Botão "Exportar Excel" em todas as telas (6B.2).
- [ ] Comparação com período anterior em todos os relatórios.
- [ ] MCP (seção 7) + API keys + `mcp_log`.
- [ ] Lembrete diário (cron Vercel 07:00) por e-mail com as ações do dia por usuário.
- [ ] Ajustes levantados no uso da primeira semana.

### Entrega 3 — data a combinar após levantamento do modelo de orçamento
- [ ] Editor de orçamento `/orcamentos/[id]` com itens, PDF e Excel conforme modelo anexo (6A.2).
- [ ] Tool MCP `montar_orcamento`.
- [ ] Envio por WhatsApp com link assinado.

### Fora do escopo
E-mail integrado, extensão de WhatsApp, tabelas de preço por cliente/região/volume, automações de marketing, múltiplos idiomas, app nativo.

---

## 9. Critérios de aceite gerais

1. Todas as telas funcionam em 390px de largura sem scroll horizontal.
2. Nenhuma ação de rotina (registrar contato, concluir ação, mover etapa) exige mais de 2 toques além da digitação.
3. Vendedor logado nunca vê negociação de outro (testar via UI e via API REST do Supabase com o token do vendedor).
4. Números da aba Presidência conferem com consultas diretas às views no SQL Editor.
5. Importação de 500 empresas + 800 negociações roda em menos de 60 s e o relatório de erros é legível.
6. Lighthouse mobile ≥ 80 em performance nas rotas `/hoje` e `/funil`.
7. Sem `any` no TypeScript; `zod` em toda entrada de Server Action e tool MCP.

---

## 10. Dúvidas a resolver com o Levy antes de começar

1. Domínio de produção e conta Vercel/Supabase (quem é o dono).
2. Lista definitiva de linhas, origens e motivos de perda (seed 3.3 é o padrão).
3. Formato exato do CSV atual para ajustar o mapeamento da seção 6.
4. Se vendedores devem ver empresas de todos (padrão: sim) ou só a própria carteira.
5. Modelo de orçamento atual da F-Led (PDF ou Excel) — anexo a esta especificação; base para o layout de 6A.2.
6. Lista de produtos com preço base para o seed inicial (`produtos.csv`).

---

## Anexos
- **Anexo A — Modelo de orçamento F-Led** (enviado junto com esta especificação). Referência obrigatória para o PDF e o Excel gerados na entrega 3.
