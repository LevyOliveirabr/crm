export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          nome: string;
          email: string;
          perfil: Database["public"]["Enums"]["perfil_usuario"];
          ativo: boolean;
          criado_em: string;
          gerente_id: string | null;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
          perfil?: Database["public"]["Enums"]["perfil_usuario"];
          ativo?: boolean;
          criado_em?: string;
          gerente_id?: string | null;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          perfil?: Database["public"]["Enums"]["perfil_usuario"];
          ativo?: boolean;
          criado_em?: string;
          gerente_id?: string | null;
        };
        Relationships: [];
      };
      funis: {
        Row: {
          id: string;
          nome: string;
          ordem: number;
          ativo: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
        };
        Relationships: [];
      };
      etapas: {
        Row: {
          id: string;
          funil_id: string;
          nome: string;
          ordem: number;
          dica: string | null;
          conta_como_proposta: boolean;
          ativo: boolean;
          probabilidade: number | null;
        };
        Insert: {
          id?: string;
          funil_id: string;
          nome: string;
          ordem: number;
          dica?: string | null;
          conta_como_proposta?: boolean;
          ativo?: boolean;
          probabilidade?: number | null;
        };
        Update: {
          id?: string;
          funil_id?: string;
          nome?: string;
          ordem?: number;
          dica?: string | null;
          conta_como_proposta?: boolean;
          ativo?: boolean;
          probabilidade?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "etapas_funil_id_fkey";
            columns: ["funil_id"];
            isOneToOne: false;
            referencedRelation: "funis";
            referencedColumns: ["id"];
          },
        ];
      };
      listas: {
        Row: {
          id: string;
          tipo: Database["public"]["Enums"]["tipo_lista"];
          valor: string;
          ordem: number;
          ativo: boolean;
        };
        Insert: {
          id?: string;
          tipo: Database["public"]["Enums"]["tipo_lista"];
          valor: string;
          ordem?: number;
          ativo?: boolean;
        };
        Update: {
          id?: string;
          tipo?: Database["public"]["Enums"]["tipo_lista"];
          valor?: string;
          ordem?: number;
          ativo?: boolean;
        };
        Relationships: [];
      };
      config: {
        Row: {
          chave: string;
          valor: string;
        };
        Insert: {
          chave: string;
          valor: string;
        };
        Update: {
          chave?: string;
          valor?: string;
        };
        Relationships: [];
      };
      empresas: {
        Row: {
          id: string;
          nome: string;
          cidade: string | null;
          uf: string | null;
          segmento: string | null;
          tipo_segmento: Database["public"]["Enums"]["tipo_segmento"] | null;
          cnpj: string | null;
          responsavel_id: string | null;
          observacoes: string | null;
          arquivado_em: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          cidade?: string | null;
          uf?: string | null;
          segmento?: string | null;
          tipo_segmento?: Database["public"]["Enums"]["tipo_segmento"] | null;
          cnpj?: string | null;
          responsavel_id?: string | null;
          observacoes?: string | null;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          cidade?: string | null;
          uf?: string | null;
          segmento?: string | null;
          tipo_segmento?: Database["public"]["Enums"]["tipo_segmento"] | null;
          cnpj?: string | null;
          responsavel_id?: string | null;
          observacoes?: string | null;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "empresas_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      contatos: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          whatsapp: string | null;
          email: string | null;
          cargo: string | null;
          decisor: boolean;
          arquivado_em: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          whatsapp?: string | null;
          email?: string | null;
          cargo?: string | null;
          decisor?: boolean;
          arquivado_em?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          whatsapp?: string | null;
          email?: string | null;
          cargo?: string | null;
          decisor?: boolean;
          arquivado_em?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contatos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      negociacoes: {
        Row: {
          id: string;
          empresa_id: string;
          contato_id: string | null;
          funil_id: string;
          etapa_id: string;
          titulo: string;
          linha: string | null;
          origem: string | null;
          valor_estimado: number;
          temperatura: number;
          previsao_mes: string | null;
          data_faturamento: string | null;
          categoria_forecast: Database["public"]["Enums"]["categoria_forecast"] | null;
          previsao_data: string | null;
          responsavel_id: string;
          emitente_id: string;
          status: Database["public"]["Enums"]["status_negociacao"];
          valor_final: number | null;
          motivo_perda: string | null;
          anotacao_fechamento: string | null;
          fechado_em: string | null;
          etapa_desde: string;
          arquivado_em: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          contato_id?: string | null;
          funil_id: string;
          etapa_id: string;
          titulo: string;
          linha?: string | null;
          origem?: string | null;
          valor_estimado?: number;
          temperatura?: number;
          previsao_mes?: string | null;
          data_faturamento?: string | null;
          categoria_forecast?: Database["public"]["Enums"]["categoria_forecast"] | null;
          previsao_data?: string | null;
          responsavel_id: string;
          /** Default no banco = emitente padrão até a migration 0009. */
          emitente_id?: string;
          status?: Database["public"]["Enums"]["status_negociacao"];
          valor_final?: number | null;
          motivo_perda?: string | null;
          anotacao_fechamento?: string | null;
          fechado_em?: string | null;
          etapa_desde?: string;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          contato_id?: string | null;
          funil_id?: string;
          etapa_id?: string;
          titulo?: string;
          linha?: string | null;
          origem?: string | null;
          valor_estimado?: number;
          temperatura?: number;
          previsao_mes?: string | null;
          data_faturamento?: string | null;
          categoria_forecast?: Database["public"]["Enums"]["categoria_forecast"] | null;
          previsao_data?: string | null;
          responsavel_id?: string;
          emitente_id?: string;
          status?: Database["public"]["Enums"]["status_negociacao"];
          valor_final?: number | null;
          motivo_perda?: string | null;
          anotacao_fechamento?: string | null;
          fechado_em?: string | null;
          etapa_desde?: string;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "negociacoes_emitente_id_fkey";
            columns: ["emitente_id"];
            isOneToOne: false;
            referencedRelation: "emitentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "negociacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "negociacoes_contato_id_fkey";
            columns: ["contato_id"];
            isOneToOne: false;
            referencedRelation: "contatos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "negociacoes_funil_id_fkey";
            columns: ["funil_id"];
            isOneToOne: false;
            referencedRelation: "funis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "negociacoes_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "negociacoes_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      interacoes: {
        Row: {
          id: string;
          negociacao_id: string;
          tipo: Database["public"]["Enums"]["tipo_interacao"];
          texto: string | null;
          usuario_id: string | null;
          origem_agente: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          negociacao_id: string;
          tipo: Database["public"]["Enums"]["tipo_interacao"];
          texto?: string | null;
          usuario_id?: string | null;
          origem_agente?: boolean;
          criado_em?: string;
        };
        Update: {
          id?: string;
          negociacao_id?: string;
          tipo?: Database["public"]["Enums"]["tipo_interacao"];
          texto?: string | null;
          usuario_id?: string | null;
          origem_agente?: boolean;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interacoes_negociacao_id_fkey";
            columns: ["negociacao_id"];
            isOneToOne: false;
            referencedRelation: "negociacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interacoes_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      acoes: {
        Row: {
          id: string;
          negociacao_id: string;
          descricao: string;
          tipo: Database["public"]["Enums"]["tipo_acao"];
          data: string;
          hora: string | null;
          responsavel_id: string;
          concluida_em: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          negociacao_id: string;
          descricao: string;
          tipo?: Database["public"]["Enums"]["tipo_acao"];
          data: string;
          hora?: string | null;
          responsavel_id: string;
          concluida_em?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          negociacao_id?: string;
          descricao?: string;
          tipo?: Database["public"]["Enums"]["tipo_acao"];
          data?: string;
          hora?: string | null;
          responsavel_id?: string;
          concluida_em?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "acoes_negociacao_id_fkey";
            columns: ["negociacao_id"];
            isOneToOne: false;
            referencedRelation: "negociacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acoes_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      orcamentos: {
        Row: {
          id: string;
          negociacao_id: string;
          numero: string | null;
          valor: number;
          enviado_em: string;
          validade: string | null;
          arquivo_path: string | null;
          situacao: Database["public"]["Enums"]["situacao_orcamento"];
          criado_em: string;
          origem: string;
          titulo: string | null;
          condicoes_pagamento: string | null;
          prazo_entrega: string | null;
          frete: string | null;
          observacoes: string | null;
          desconto_geral_pct: number;
          subtotal: number | null;
          arquivo_pdf_path: string | null;
          arquivo_xlsx_path: string | null;
          aceito_em: string | null;
          aceito_por: string | null;
        };
        Insert: {
          id?: string;
          negociacao_id: string;
          numero?: string | null;
          valor: number;
          aceito_em?: string | null;
          aceito_por?: string | null;
          enviado_em?: string;
          validade?: string | null;
          arquivo_path?: string | null;
          situacao?: Database["public"]["Enums"]["situacao_orcamento"];
          criado_em?: string;
          origem?: string;
          titulo?: string | null;
          condicoes_pagamento?: string | null;
          prazo_entrega?: string | null;
          frete?: string | null;
          observacoes?: string | null;
          desconto_geral_pct?: number;
          subtotal?: number | null;
          arquivo_pdf_path?: string | null;
          arquivo_xlsx_path?: string | null;
        };
        Update: {
          id?: string;
          negociacao_id?: string;
          numero?: string | null;
          valor?: number;
          enviado_em?: string;
          validade?: string | null;
          arquivo_path?: string | null;
          situacao?: Database["public"]["Enums"]["situacao_orcamento"];
          criado_em?: string;
          origem?: string;
          titulo?: string | null;
          condicoes_pagamento?: string | null;
          prazo_entrega?: string | null;
          frete?: string | null;
          observacoes?: string | null;
          desconto_geral_pct?: number;
          subtotal?: number | null;
          arquivo_pdf_path?: string | null;
          arquivo_xlsx_path?: string | null;
          aceito_em?: string | null;
          aceito_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orcamentos_negociacao_id_fkey";
            columns: ["negociacao_id"];
            isOneToOne: false;
            referencedRelation: "negociacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      produtos: {
        Row: {
          id: string;
          codigo: string | null;
          nome: string;
          descricao: string | null;
          linha: string | null;
          unidade: string;
          preco_base: number;
          ativo: boolean;
          emitente_id: string;
          categoria_id: string | null;
          link: string | null;
          catalogo_path: string | null;
          catalogo_url: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          codigo?: string | null;
          nome: string;
          descricao?: string | null;
          linha?: string | null;
          unidade?: string;
          preco_base?: number;
          ativo?: boolean;
          emitente_id?: string;
          categoria_id?: string | null;
          link?: string | null;
          catalogo_path?: string | null;
          catalogo_url?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          codigo?: string | null;
          nome?: string;
          descricao?: string | null;
          linha?: string | null;
          unidade?: string;
          preco_base?: number;
          ativo?: boolean;
          emitente_id?: string;
          categoria_id?: string | null;
          link?: string | null;
          catalogo_path?: string | null;
          catalogo_url?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "produtos_emitente_id_fkey";
            columns: ["emitente_id"];
            isOneToOne: false;
            referencedRelation: "emitentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "produtos_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_produto";
            referencedColumns: ["id"];
          },
        ];
      };
      orcamento_itens: {
        Row: {
          id: string;
          orcamento_id: string;
          produto_id: string | null;
          ordem: number;
          descricao: string;
          unidade: string;
          quantidade: number;
          preco_unitario: number;
          desconto_pct: number;
          total: number;
        };
        Insert: {
          id?: string;
          orcamento_id: string;
          produto_id?: string | null;
          ordem?: number;
          descricao: string;
          unidade?: string;
          quantidade?: number;
          preco_unitario: number;
          desconto_pct?: number;
          total?: number;
        };
        Update: {
          id?: string;
          orcamento_id?: string;
          produto_id?: string | null;
          ordem?: number;
          descricao?: string;
          unidade?: string;
          quantidade?: number;
          preco_unitario?: number;
          desconto_pct?: number;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey";
            columns: ["orcamento_id"];
            isOneToOne: false;
            referencedRelation: "orcamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          },
        ];
      };
      emitente: {
        Row: {
          id: number;
          razao_social: string;
          cnpj: string | null;
          endereco: string | null;
          telefone: string | null;
          email: string | null;
          site: string | null;
          logo_path: string | null;
          validade_padrao_dias: number;
          condicoes_pagamento_padrao: string | null;
          prazo_entrega_padrao: string | null;
          rodape: string | null;
        };
        Insert: {
          id?: number;
          razao_social: string;
          cnpj?: string | null;
          endereco?: string | null;
          telefone?: string | null;
          email?: string | null;
          site?: string | null;
          logo_path?: string | null;
          validade_padrao_dias?: number;
          condicoes_pagamento_padrao?: string | null;
          prazo_entrega_padrao?: string | null;
          rodape?: string | null;
        };
        Update: {
          id?: number;
          razao_social?: string;
          cnpj?: string | null;
          endereco?: string | null;
          telefone?: string | null;
          email?: string | null;
          site?: string | null;
          logo_path?: string | null;
          validade_padrao_dias?: number;
          condicoes_pagamento_padrao?: string | null;
          prazo_entrega_padrao?: string | null;
          rodape?: string | null;
        };
        Relationships: [];
      };
      emitentes: {
        Row: {
          id: string;
          nome: string;
          razao_social: string;
          cnpj: string | null;
          endereco: string | null;
          telefone: string | null;
          email: string | null;
          site: string | null;
          logo_path: string | null;
          validade_padrao_dias: number;
          condicoes_pagamento_padrao: string | null;
          prazo_entrega_padrao: string | null;
          rodape: string | null;
          orcamento_prefixo: string;
          orcamento_proximo_numero: number;
          ordem: number;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          razao_social: string;
          cnpj?: string | null;
          endereco?: string | null;
          telefone?: string | null;
          email?: string | null;
          site?: string | null;
          logo_path?: string | null;
          validade_padrao_dias?: number;
          condicoes_pagamento_padrao?: string | null;
          prazo_entrega_padrao?: string | null;
          rodape?: string | null;
          orcamento_prefixo?: string;
          orcamento_proximo_numero?: number;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          razao_social?: string;
          cnpj?: string | null;
          endereco?: string | null;
          telefone?: string | null;
          email?: string | null;
          site?: string | null;
          logo_path?: string | null;
          validade_padrao_dias?: number;
          condicoes_pagamento_padrao?: string | null;
          prazo_entrega_padrao?: string | null;
          rodape?: string | null;
          orcamento_prefixo?: string;
          orcamento_proximo_numero?: number;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [];
      };
      usuario_emitentes: {
        Row: {
          usuario_id: string;
          emitente_id: string;
          perfil: Database["public"]["Enums"]["perfil_usuario"];
          gerente_id: string | null;
          criado_em: string;
        };
        Insert: {
          usuario_id: string;
          emitente_id: string;
          perfil?: Database["public"]["Enums"]["perfil_usuario"];
          gerente_id?: string | null;
          criado_em?: string;
        };
        Update: {
          usuario_id?: string;
          emitente_id?: string;
          perfil?: Database["public"]["Enums"]["perfil_usuario"];
          gerente_id?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuario_emitentes_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usuario_emitentes_emitente_id_fkey";
            columns: ["emitente_id"];
            isOneToOne: false;
            referencedRelation: "emitentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usuario_emitentes_gerente_id_fkey";
            columns: ["gerente_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias_produto: {
        Row: {
          id: string;
          emitente_id: string;
          nome: string;
          descricao: string | null;
          catalogo_path: string | null;
          catalogo_url: string | null;
          ordem: number;
          ativo: boolean;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          emitente_id: string;
          nome: string;
          descricao?: string | null;
          catalogo_path?: string | null;
          catalogo_url?: string | null;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          emitente_id?: string;
          nome?: string;
          descricao?: string | null;
          catalogo_path?: string | null;
          catalogo_url?: string | null;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_produto_emitente_id_fkey";
            columns: ["emitente_id"];
            isOneToOne: false;
            referencedRelation: "emitentes";
            referencedColumns: ["id"];
          },
        ];
      };
      metas: {
        Row: {
          id: string;
          responsavel_id: string;
          emitente_id: string;
          mes: string;
          valor: number;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          responsavel_id: string;
          emitente_id?: string;
          mes: string;
          valor?: number;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          id?: string;
          responsavel_id?: string;
          emitente_id?: string;
          mes?: string;
          valor?: number;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metas_emitente_id_fkey";
            columns: ["emitente_id"];
            isOneToOne: false;
            referencedRelation: "emitentes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metas_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      etapa_historico: {
        Row: {
          id: number;
          negociacao_id: string;
          etapa_id: string;
          entrou_em: string;
          saiu_em: string | null;
        };
        Insert: {
          id?: never;
          negociacao_id: string;
          etapa_id: string;
          entrou_em?: string;
          saiu_em?: string | null;
        };
        Update: {
          id?: never;
          negociacao_id?: string;
          etapa_id?: string;
          entrou_em?: string;
          saiu_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "etapa_historico_negociacao_id_fkey";
            columns: ["negociacao_id"];
            isOneToOne: false;
            referencedRelation: "negociacoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "etapa_historico_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "etapas";
            referencedColumns: ["id"];
          },
        ];
      };
      mcp_log: {
        Row: {
          id: number;
          key_id: string | null;
          tool: string;
          args: Json | null;
          ok: boolean;
          erro: string | null;
          ms: number | null;
          criado_em: string;
        };
        Insert: {
          id?: number;
          key_id?: string | null;
          tool: string;
          args?: Json | null;
          ok: boolean;
          erro?: string | null;
          ms?: number | null;
          criado_em?: string;
        };
        Update: {
          id?: number;
          key_id?: string | null;
          tool?: string;
          args?: Json | null;
          ok?: boolean;
          erro?: string | null;
          ms?: number | null;
          criado_em?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          usuario_id: string;
          nome: string;
          key_hash: string;
          criado_em: string;
          revogado_em: string | null;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          nome: string;
          key_hash: string;
          criado_em?: string;
          revogado_em?: string | null;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          nome?: string;
          key_hash?: string;
          criado_em?: string;
          revogado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_negociacoes: {
        Row: {
          id: string | null;
          empresa_id: string | null;
          contato_id: string | null;
          funil_id: string | null;
          etapa_id: string | null;
          titulo: string | null;
          linha: string | null;
          origem: string | null;
          valor_estimado: number | null;
          temperatura: number | null;
          previsao_mes: string | null;
          data_faturamento: string | null;
          categoria_forecast: Database["public"]["Enums"]["categoria_forecast"] | null;
          previsao_data: string | null;
          responsavel_id: string | null;
          status: Database["public"]["Enums"]["status_negociacao"] | null;
          valor_final: number | null;
          motivo_perda: string | null;
          anotacao_fechamento: string | null;
          fechado_em: string | null;
          etapa_desde: string | null;
          arquivado_em: string | null;
          criado_em: string | null;
          atualizado_em: string | null;
          empresa_nome: string | null;
          empresa_cidade: string | null;
          etapa_nome: string | null;
          etapa_ordem: number | null;
          funil_nome: string | null;
          responsavel_nome: string | null;
          dias_na_etapa: number | null;
          ultima_interacao: string | null;
          dias_sem_interacao: number | null;
          parada: boolean | null;
          proxima_acao_data: string | null;
          proxima_acao_descricao: string | null;
          acao_atrasada: boolean | null;
          sem_acao: boolean | null;
          empresa_uf: string | null;
          empresa_tipo_segmento: Database["public"]["Enums"]["tipo_segmento"] | null;
          etapa_probabilidade: number | null;
          emitente_id: string | null;
          emitente_nome: string | null;
        };
        Relationships: [];
      };
      v_resultado_mensal: {
        Row: {
          mes: string | null;
          responsavel_id: string | null;
          emitente_id: string | null;
          vendido: number | null;
          qtd_vendida: number | null;
          perdido: number | null;
          qtd_perdida: number | null;
          ticket_medio: number | null;
          ciclo_dias: number | null;
        };
        Relationships: [];
      };
      v_previsao: {
        Row: {
          mes: string | null;
          responsavel_id: string | null;
          emitente_id: string | null;
          aberto: number | null;
          realista: number | null;
          otimista: number | null;
          qtd: number | null;
        };
        Relationships: [];
      };
      v_funil: {
        Row: {
          funil_id: string | null;
          funil: string | null;
          etapa_id: string | null;
          etapa: string | null;
          ordem: number | null;
          emitente_id: string | null;
          qtd: number | null;
          valor: number | null;
        };
        Relationships: [];
      };
      v_motivos_perda: {
        Row: {
          mes: string | null;
          responsavel_id: string | null;
          emitente_id: string | null;
          linha: string | null;
          motivo_perda: string | null;
          qtd: number | null;
          valor: number | null;
        };
        Relationships: [];
      };
      v_empresas: {
        Row: {
          id: string | null;
          nome: string | null;
          cidade: string | null;
          uf: string | null;
          segmento: string | null;
          cnpj: string | null;
          responsavel_id: string | null;
          responsavel_nome: string | null;
          observacoes: string | null;
          criado_em: string | null;
          atualizado_em: string | null;
          aberto: number | null;
          vendido: number | null;
          perdido: number | null;
          qtd_negociacoes: number | null;
          qtd_abertas: number | null;
          ticket_medio: number | null;
          ciclo_medio_dias: number | null;
          ultimo_contato: string | null;
          tipo_segmento: Database["public"]["Enums"]["tipo_segmento"] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      relatorio_presidencia: {
        Args: { p_mes?: string; p_emitente?: string | null };
        Returns: Json;
      };
      eh_diretor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      eh_diretor_de: {
        Args: { p_emitente: string };
        Returns: boolean;
      };
      eh_membro_de: {
        Args: { p_emitente: string };
        Returns: boolean;
      };
      eh_gerente_de: {
        Args: { p_usuario: string; p_emitente: string };
        Returns: boolean;
      };
      minhas_empresas: {
        Args: Record<string, never>;
        Returns: string[];
      };
      proximo_numero_orcamento: {
        Args: { p_emitente: string };
        Returns: string;
      };
      f_unaccent: {
        Args: { "": string };
        Returns: string;
      };
    };
    Enums: {
      perfil_usuario: "diretor" | "gerente" | "vendedor";
      /** Não é enum no Postgres (check constraint em negociacoes.categoria_forecast). */
      categoria_forecast: "compromisso" | "provavel" | "possivel";
      tipo_lista: "segmento" | "linha" | "origem" | "motivo_perda";
      status_negociacao: "aberta" | "vendida" | "perdida";
      /** Não é enum no Postgres (check constraint em empresas.tipo_segmento). */
      tipo_segmento: "publico" | "privado" | "ppp";
      tipo_interacao:
        | "ligacao"
        | "whatsapp"
        | "visita"
        | "reuniao"
        | "email"
        | "anotacao"
        | "sistema";
      tipo_acao:
        | "ligar"
        | "whatsapp"
        | "visita"
        | "reuniao"
        | "proposta"
        | "outro";
      situacao_orcamento: "enviado" | "aprovado" | "recusado" | "substituido";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
