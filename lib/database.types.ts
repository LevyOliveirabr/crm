export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      acoes: {
        Row: {
          id: string;
          negociacao_id: string;
          descricao: string;
          tipo: Database['public']['Enums']['tipo_acao'];
          data: string;
          hora: string | null;
          responsavel_id: string;
          concluida_em: string | null;
          criado_em: string;
        }
        Insert: {
          id?: string;
          negociacao_id: string;
          descricao: string;
          tipo?: Database['public']['Enums']['tipo_acao'];
          data: string;
          hora?: string | null;
          responsavel_id: string;
          concluida_em?: string | null;
          criado_em?: string;
        }
        Update: {
          id?: string;
          negociacao_id?: string;
          descricao?: string;
          tipo?: Database['public']['Enums']['tipo_acao'];
          data?: string;
          hora?: string | null;
          responsavel_id?: string;
          concluida_em?: string | null;
          criado_em?: string;
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          id: string;
          usuario_id: string;
          nome: string;
          key_hash: string;
          criado_em: string;
          revogado_em: string | null;
        }
        Insert: {
          id?: string;
          usuario_id: string;
          nome: string;
          key_hash: string;
          criado_em?: string;
          revogado_em?: string | null;
        }
        Update: {
          id?: string;
          usuario_id?: string;
          nome?: string;
          key_hash?: string;
          criado_em?: string;
          revogado_em?: string | null;
        }
        Relationships: []
      }
      config: {
        Row: {
          chave: string;
          valor: string;
        }
        Insert: {
          chave: string;
          valor: string;
        }
        Update: {
          chave?: string;
          valor?: string;
        }
        Relationships: []
      }
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
        }
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
        }
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
        }
        Relationships: []
      }
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
        }
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
        }
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
        }
        Relationships: []
      }
      empresas: {
        Row: {
          id: string;
          nome: string;
          cidade: string | null;
          uf: string | null;
          segmento: string | null;
          cnpj: string | null;
          responsavel_id: string | null;
          observacoes: string | null;
          arquivado_em: string | null;
          criado_em: string;
          atualizado_em: string;
        }
        Insert: {
          id?: string;
          nome: string;
          cidade?: string | null;
          uf?: string | null;
          segmento?: string | null;
          cnpj?: string | null;
          responsavel_id?: string | null;
          observacoes?: string | null;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        }
        Update: {
          id?: string;
          nome?: string;
          cidade?: string | null;
          uf?: string | null;
          segmento?: string | null;
          cnpj?: string | null;
          responsavel_id?: string | null;
          observacoes?: string | null;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        }
        Relationships: []
      }
      etapas: {
        Row: {
          id: string;
          funil_id: string;
          nome: string;
          ordem: number;
          dica: string | null;
          conta_como_proposta: boolean;
          ativo: boolean;
        }
        Insert: {
          id?: string;
          funil_id: string;
          nome: string;
          ordem: number;
          dica?: string | null;
          conta_como_proposta?: boolean;
          ativo?: boolean;
        }
        Update: {
          id?: string;
          funil_id?: string;
          nome?: string;
          ordem?: number;
          dica?: string | null;
          conta_como_proposta?: boolean;
          ativo?: boolean;
        }
        Relationships: []
      }
      funis: {
        Row: {
          id: string;
          nome: string;
          ordem: number;
          ativo: boolean;
          criado_em: string;
        }
        Insert: {
          id?: string;
          nome: string;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
        }
        Update: {
          id?: string;
          nome?: string;
          ordem?: number;
          ativo?: boolean;
          criado_em?: string;
        }
        Relationships: []
      }
      interacoes: {
        Row: {
          id: string;
          negociacao_id: string;
          tipo: Database['public']['Enums']['tipo_interacao'];
          texto: string | null;
          usuario_id: string | null;
          origem_agente: boolean;
          criado_em: string;
        }
        Insert: {
          id?: string;
          negociacao_id: string;
          tipo: Database['public']['Enums']['tipo_interacao'];
          texto?: string | null;
          usuario_id?: string | null;
          origem_agente?: boolean;
          criado_em?: string;
        }
        Update: {
          id?: string;
          negociacao_id?: string;
          tipo?: Database['public']['Enums']['tipo_interacao'];
          texto?: string | null;
          usuario_id?: string | null;
          origem_agente?: boolean;
          criado_em?: string;
        }
        Relationships: []
      }
      listas: {
        Row: {
          id: string;
          tipo: Database['public']['Enums']['tipo_lista'];
          valor: string;
          ordem: number;
          ativo: boolean;
        }
        Insert: {
          id?: string;
          tipo: Database['public']['Enums']['tipo_lista'];
          valor: string;
          ordem?: number;
          ativo?: boolean;
        }
        Update: {
          id?: string;
          tipo?: Database['public']['Enums']['tipo_lista'];
          valor?: string;
          ordem?: number;
          ativo?: boolean;
        }
        Relationships: []
      }
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
        }
        Insert: {
          id: number;
          key_id?: string | null;
          tool: string;
          args?: Json | null;
          ok: boolean;
          erro?: string | null;
          ms?: number | null;
          criado_em?: string;
        }
        Update: {
          id?: number;
          key_id?: string | null;
          tool?: string;
          args?: Json | null;
          ok?: boolean;
          erro?: string | null;
          ms?: number | null;
          criado_em?: string;
        }
        Relationships: []
      }
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
          responsavel_id: string;
          status: Database['public']['Enums']['status_negociacao'];
          valor_final: number | null;
          motivo_perda: string | null;
          anotacao_fechamento: string | null;
          fechado_em: string | null;
          etapa_desde: string;
          arquivado_em: string | null;
          criado_em: string;
          atualizado_em: string;
        }
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
          responsavel_id: string;
          status?: Database['public']['Enums']['status_negociacao'];
          valor_final?: number | null;
          motivo_perda?: string | null;
          anotacao_fechamento?: string | null;
          fechado_em?: string | null;
          etapa_desde?: string;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        }
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
          responsavel_id?: string;
          status?: Database['public']['Enums']['status_negociacao'];
          valor_final?: number | null;
          motivo_perda?: string | null;
          anotacao_fechamento?: string | null;
          fechado_em?: string | null;
          etapa_desde?: string;
          arquivado_em?: string | null;
          criado_em?: string;
          atualizado_em?: string;
        }
        Relationships: []
      }
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
          total: number | null;
        }
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
          total?: number | null;
        }
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
          total?: number | null;
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          id: string;
          negociacao_id: string;
          numero: string | null;
          valor: number;
          enviado_em: string;
          validade: string | null;
          arquivo_path: string | null;
          situacao: Database['public']['Enums']['situacao_orcamento'];
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
        }
        Insert: {
          id?: string;
          negociacao_id: string;
          numero?: string | null;
          valor: number;
          enviado_em?: string;
          validade?: string | null;
          arquivo_path?: string | null;
          situacao?: Database['public']['Enums']['situacao_orcamento'];
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
        }
        Update: {
          id?: string;
          negociacao_id?: string;
          numero?: string | null;
          valor?: number;
          enviado_em?: string;
          validade?: string | null;
          arquivo_path?: string | null;
          situacao?: Database['public']['Enums']['situacao_orcamento'];
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
        }
        Relationships: []
      }
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
          criado_em: string;
          atualizado_em: string;
        }
        Insert: {
          id?: string;
          codigo?: string | null;
          nome: string;
          descricao?: string | null;
          linha?: string | null;
          unidade?: string;
          preco_base?: number;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        }
        Update: {
          id?: string;
          codigo?: string | null;
          nome?: string;
          descricao?: string | null;
          linha?: string | null;
          unidade?: string;
          preco_base?: number;
          ativo?: boolean;
          criado_em?: string;
          atualizado_em?: string;
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          id: string;
          nome: string;
          email: string;
          perfil: Database['public']['Enums']['perfil_usuario'];
          ativo: boolean;
          criado_em: string;
        }
        Insert: {
          id: string;
          nome: string;
          email: string;
          perfil?: Database['public']['Enums']['perfil_usuario'];
          ativo?: boolean;
          criado_em?: string;
        }
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          perfil?: Database['public']['Enums']['perfil_usuario'];
          ativo?: boolean;
          criado_em?: string;
        }
        Relationships: []
      }
    }
    Views: {
      v_funil: {
        Row: {
          funil_id: string | null;
          funil: string | null;
          etapa_id: string | null;
          etapa: string | null;
          ordem: number | null;
          qtd: number | null;
          valor: number | null;
        }
        Relationships: []
      }
      v_motivos_perda: {
        Row: {
          mes: string | null;
          responsavel_id: string | null;
          linha: string | null;
          motivo_perda: string | null;
          qtd: number | null;
          valor: number | null;
        }
        Relationships: []
      }
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
          responsavel_id: string | null;
          status: Database['public']['Enums']['status_negociacao'] | null;
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
        }
        Relationships: []
      }
      v_previsao: {
        Row: {
          mes: string | null;
          responsavel_id: string | null;
          aberto: number | null;
          realista: number | null;
          otimista: number | null;
          qtd: number | null;
        }
        Relationships: []
      }
      v_resultado_mensal: {
        Row: {
          mes: string | null;
          responsavel_id: string | null;
          vendido: number | null;
          qtd_vendida: number | null;
          perdido: number | null;
          qtd_perdida: number | null;
          ticket_medio: number | null;
          ciclo_dias: number | null;
        }
        Relationships: []
      }
    }
    Functions: {
      relatorio_presidencia: { Args: { p_mes?: string }; Returns: Json }
      eh_diretor: { Args: Record<string, never>; Returns: boolean }
      f_unaccent: { Args: { '': string }; Returns: string }
    }
    Enums: {
      perfil_usuario: "diretor" | "vendedor"
      situacao_orcamento: "enviado" | "aprovado" | "recusado" | "substituido"
      status_negociacao: "aberta" | "vendida" | "perdida"
      tipo_acao: "ligar" | "whatsapp" | "visita" | "reuniao" | "proposta" | "outro"
      tipo_interacao: "ligacao" | "whatsapp" | "visita" | "reuniao" | "email" | "anotacao" | "sistema"
      tipo_lista: "segmento" | "linha" | "origem" | "motivo_perda"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
