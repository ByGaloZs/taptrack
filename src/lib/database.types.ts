export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          merchant: string;
          amount: number;
          currency: string;
          card: string;
          occurred_at: string;
          source: string;
          client_transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant: string;
          amount: number;
          currency: string;
          card: string;
          occurred_at: string;
          source: string;
          client_transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant?: string;
          amount?: number;
          currency?: string;
          card?: string;
          occurred_at?: string;
          source?: string;
          client_transaction_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transaction_events: {
        Row: {
          id: string;
          payload: Json;
          status: string;
          error: string | null;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payload: Json;
          status: string;
          error?: string | null;
          transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          payload?: Json;
          status?: string;
          error?: string | null;
          transaction_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
