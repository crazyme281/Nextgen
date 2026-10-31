export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_configurations: {
        Row: {
          config: Json
          difficulty: Database["public"]["Enums"]["ai_difficulty"]
          game_id: string
          id: string
          max_search_depth: number | null
          max_time_ms: number | null
        }
        Insert: {
          config?: Json
          difficulty: Database["public"]["Enums"]["ai_difficulty"]
          game_id: string
          id?: string
          max_search_depth?: number | null
          max_time_ms?: number | null
        }
        Update: {
          config?: Json
          difficulty?: Database["public"]["Enums"]["ai_difficulty"]
          game_id?: string
          id?: string
          max_search_depth?: number | null
          max_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_configurations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ai_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_projects: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "ai_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "ai_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_list_members: {
        Row: {
          broadcast_list_id: string
          user_id: string
        }
        Insert: {
          broadcast_list_id: string
          user_id: string
        }
        Update: {
          broadcast_list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_list_members_broadcast_list_id_fkey"
            columns: ["broadcast_list_id"]
            isOneToOne: false
            referencedRelation: "broadcast_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_list_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "broadcast_list_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "broadcast_list_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "broadcast_lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "broadcast_lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_invites: {
        Row: {
          call_id: string
          call_type: string
          callee_id: string
          caller_avatar: string | null
          caller_id: string
          caller_name: string | null
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          status: string
        }
        Insert: {
          call_id: string
          call_type: string
          callee_id: string
          caller_avatar?: string | null
          caller_id: string
          caller_name?: string | null
          conversation_id: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
        }
        Update: {
          call_id?: string
          call_type?: string
          callee_id?: string
          caller_avatar?: string | null
          caller_id?: string
          caller_name?: string | null
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_invites_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "call_invites_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "call_invites_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "call_invites_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "call_invites_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "call_invites_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "group_conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          created_at: string
          duration_seconds: number
          id: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Insert: {
          call_type?: string
          callee_id: string
          caller_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Relationships: [
          {
            foreignKeyName: "calls_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "calls_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "calls_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string
          details: Json
          display_name: string | null
          is_blocked: boolean
          is_favorite: boolean
          owner_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          details?: Json
          display_name?: string | null
          is_blocked?: boolean
          is_favorite?: boolean
          owner_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          details?: Json
          display_name?: string | null
          is_blocked?: boolean
          is_favorite?: boolean
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          is_favorite: boolean
          is_muted: boolean
          joined_at: string
          last_read_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          is_favorite?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          is_favorite?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "group_conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_pairing_requests: {
        Row: {
          created_at: string
          device_label: string | null
          encrypted_user_id: string
          expires_at: string
          id: string
          iv: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          encrypted_user_id: string
          expires_at?: string
          id?: string
          iv: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          encrypted_user_id?: string
          expires_at?: string
          id?: string
          iv?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_pairing_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "device_pairing_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "device_pairing_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          game_id: string
          id: string
          invitation_token: string
          match_id: string | null
          recipient_email: string | null
          recipient_id: string | null
          sender_id: string
          status: Database["public"]["Enums"]["game_invitation_status"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          game_id: string
          id?: string
          invitation_token?: string
          match_id?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["game_invitation_status"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          game_id?: string
          id?: string
          invitation_token?: string
          match_id?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["game_invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "game_invitations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invitations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invitations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_invitations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_invitations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invitations_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_invitations_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_invitations_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_matches: {
        Row: {
          ai_difficulty: Database["public"]["Enums"]["ai_difficulty"] | null
          board_state: Json
          created_at: string
          created_by: string
          current_turn_player_id: string | null
          ended_at: string | null
          game_id: string
          id: string
          is_private: boolean
          match_token: string
          mode: Database["public"]["Enums"]["match_mode"]
          result: Database["public"]["Enums"]["match_result"] | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          ai_difficulty?: Database["public"]["Enums"]["ai_difficulty"] | null
          board_state?: Json
          created_at?: string
          created_by: string
          current_turn_player_id?: string | null
          ended_at?: string | null
          game_id: string
          id?: string
          is_private?: boolean
          match_token?: string
          mode?: Database["public"]["Enums"]["match_mode"]
          result?: Database["public"]["Enums"]["match_result"] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          ai_difficulty?: Database["public"]["Enums"]["ai_difficulty"] | null
          board_state?: Json
          created_at?: string
          created_by?: string
          current_turn_player_id?: string | null
          ended_at?: string | null
          game_id?: string
          id?: string
          is_private?: boolean
          match_token?: string
          mode?: Database["public"]["Enums"]["match_mode"]
          result?: Database["public"]["Enums"]["match_result"] | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_current_turn_player_id_fkey"
            columns: ["current_turn_player_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_matches_current_turn_player_id_fkey"
            columns: ["current_turn_player_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_matches_current_turn_player_id_fkey"
            columns: ["current_turn_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_moves: {
        Row: {
          board_state_after: Json | null
          created_at: string
          id: string
          match_id: string
          move_data: Json
          move_number: number
          player_id: string | null
        }
        Insert: {
          board_state_after?: Json | null
          created_at?: string
          id?: string
          match_id: string
          move_data: Json
          move_number: number
          player_id?: string | null
        }
        Update: {
          board_state_after?: Json | null
          created_at?: string
          id?: string
          match_id?: string
          move_data?: Json
          move_number?: number
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_moves_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_moves_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_moves_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_moves_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          ai_difficulty: Database["public"]["Enums"]["ai_difficulty"] | null
          id: string
          is_ai: boolean
          is_connected: boolean
          joined_at: string
          left_at: string | null
          match_id: string
          seat_index: number
          side: string | null
          user_id: string | null
        }
        Insert: {
          ai_difficulty?: Database["public"]["Enums"]["ai_difficulty"] | null
          id?: string
          is_ai?: boolean
          is_connected?: boolean
          joined_at?: string
          left_at?: string | null
          match_id: string
          seat_index: number
          side?: string | null
          user_id?: string | null
        }
        Update: {
          ai_difficulty?: Database["public"]["Enums"]["ai_difficulty"] | null
          id?: string
          is_ai?: boolean
          is_connected?: boolean
          joined_at?: string
          left_at?: string | null
          match_id?: string
          seat_index?: number
          side?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_ratings: {
        Row: {
          draws: number
          game_id: string
          games_played: number
          id: string
          losses: number
          rating: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          draws?: number
          game_id: string
          games_played?: number
          id?: string
          losses?: number
          rating?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          draws?: number
          game_id?: string
          games_played?: number
          id?: string
          losses?: number
          rating?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_results: {
        Row: {
          created_at: string
          id: string
          match_id: string
          rating_delta: number
          result: Database["public"]["Enums"]["match_result"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          rating_delta?: number
          result: Database["public"]["Enums"]["match_result"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          rating_delta?: number
          result?: Database["public"]["Enums"]["match_result"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "game_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          key: string
          max_players: number
          min_players: number
          name: string
          sort_order: number
          supports_ai: boolean
          supports_multiplayer: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          max_players?: number
          min_players?: number
          name: string
          sort_order?: number
          supports_ai?: boolean
          supports_multiplayer?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          max_players?: number
          min_players?: number
          name?: string
          sort_order?: number
          supports_ai?: boolean
          supports_multiplayer?: boolean
        }
        Relationships: []
      }
      group_permissions: {
        Row: {
          add_members: string
          approve_new_members: boolean
          conversation_id: string
          edit_settings: string
          invite_via_link: string
          send_messages: string
        }
        Insert: {
          add_members?: string
          approve_new_members?: boolean
          conversation_id: string
          edit_settings?: string
          invite_via_link?: string
          send_messages?: string
        }
        Update: {
          add_members?: string
          approve_new_members?: boolean
          conversation_id?: string
          edit_settings?: string
          invite_via_link?: string
          send_messages?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_permissions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "group_permissions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_permissions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "group_conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          created_at: string
          document_ref: string | null
          document_type: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_ref?: string | null
          document_type: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_ref?: string | null
          document_type?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "identity_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "identity_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_posts: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          media_url: string | null
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "live_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "live_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_comments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "live_stream_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "live_stream_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          allow_comments: boolean
          audience: string
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          notify_followers: boolean
          peak_viewers: number
          started_at: string
          status: string
          title: string
        }
        Insert: {
          allow_comments?: boolean
          audience?: string
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          notify_followers?: boolean
          peak_viewers?: number
          started_at?: string
          status?: string
          title: string
        }
        Update: {
          allow_comments?: boolean
          audience?: string
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          notify_followers?: boolean
          peak_viewers?: number
          started_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "live_streams_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "live_streams_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deletions: {
        Row: {
          deleted_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deletions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deletions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages_plain"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deletions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "starred_messages_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "message_deletions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "message_deletions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "message_deletions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages_plain"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "starred_messages_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_receipts: {
        Row: {
          delivered_at: string | null
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          delivered_at?: string | null
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          delivered_at?: string | null
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages_plain"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "starred_messages_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "message_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "message_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "message_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          encrypted_keys: Json
          game_invitation_id: string | null
          id: string
          is_deleted: boolean
          is_encrypted: boolean
          iv: string | null
          media_type: string | null
          media_url: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          encrypted_keys?: Json
          game_invitation_id?: string | null
          id?: string
          is_deleted?: boolean
          is_encrypted?: boolean
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          encrypted_keys?: Json
          game_invitation_id?: string | null
          id?: string
          is_deleted?: boolean
          is_encrypted?: boolean
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "group_conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_game_invitation_id_fkey"
            columns: ["game_invitation_id"]
            isOneToOne: false
            referencedRelation: "game_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages_plain"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "starred_messages_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_minor: number
          buyer_id: string
          created_at: string
          currency: string
          id: string
          product_id: string
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          buyer_id: string
          created_at?: string
          currency?: string
          id?: string
          product_id: string
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          id?: string
          product_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          description: string | null
          id: string
          payee_id: string
          requester_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          payee_id: string
          requester_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          payee_id?: string
          requester_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "payment_requests_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "payment_requests_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "payment_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "payment_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          price_minor: number
          seller_id: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_minor: number
          seller_id: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_minor?: number
          seller_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          is_online: boolean
          key_backup: Json | null
          last_seen_at: string | null
          phone: string | null
          public_key: Json | null
          transaction_pin_hash: string | null
          trust_level: Database["public"]["Enums"]["trust_level"]
          updated_at: string
          username: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_online?: boolean
          key_backup?: Json | null
          last_seen_at?: string | null
          phone?: string | null
          public_key?: Json | null
          transaction_pin_hash?: string | null
          trust_level?: Database["public"]["Enums"]["trust_level"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_online?: boolean
          key_backup?: Json | null
          last_seen_at?: string | null
          phone?: string | null
          public_key?: Json | null
          transaction_pin_hash?: string | null
          trust_level?: Database["public"]["Enums"]["trust_level"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_label: string | null
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_cards: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: string | null
          exp_year: string | null
          id: string
          is_default: boolean
          last4: string
          provider: string
          provider_token: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: string | null
          exp_year?: string | null
          id?: string
          is_default?: boolean
          last4: string
          provider: string
          provider_token: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: string | null
          exp_year?: string | null
          id?: string
          is_default?: boolean
          last4?: string
          provider?: string
          provider_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "saved_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "saved_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      starred_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages_plain"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "starred_messages_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "starred_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "starred_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "starred_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          author_id: string
          background_color: string | null
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string | null
        }
        Insert: {
          author_id: string
          background_color?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
        }
        Update: {
          author_id?: string
          background_color?: string | null
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          story_id: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "story_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "story_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "story_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "story_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          provider: string
          provider_account_id: string | null
          provider_customer_id: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          provider: string
          provider_account_id?: string | null
          provider_customer_id?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          provider?: string
          provider_account_id?: string | null
          provider_customer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "virtual_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "virtual_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_minor: number
          counterparty_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          reference: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          amount_minor: number
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          reference?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          amount_minor?: number
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          reference?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "wallet_transactions_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "wallet_transactions_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_minor: number
          created_at: string
          currency: string
          user_id: string
        }
        Insert: {
          balance_minor?: number
          created_at?: string
          currency?: string
          user_id: string
        }
        Update: {
          balance_minor?: number
          created_at?: string
          currency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      call_log_view: {
        Row: {
          call_type: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["call_direction"] | null
          duration_seconds: number | null
          id: string | null
          peer_avatar_url: string | null
          peer_full_name: string | null
          peer_id: string | null
          peer_trust_level: Database["public"]["Enums"]["trust_level"] | null
          status: Database["public"]["Enums"]["call_status"] | null
          viewer_id: string | null
        }
        Relationships: []
      }
      contacts_view: {
        Row: {
          avatar_url: string | null
          contact_user_id: string | null
          full_name: string | null
          is_favorite: boolean | null
          owner_id: string | null
          phone: string | null
          trust_level: Database["public"]["Enums"]["trust_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          conversation_id: string | null
          is_favorite: boolean | null
          last_message: string | null
          last_message_at: string | null
          other_avatar_url: string | null
          other_full_name: string | null
          other_trust_level: Database["public"]["Enums"]["trust_level"] | null
          other_user_id: string | null
          unread_count: number | null
          viewer_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_statistics_view: {
        Row: {
          draws: number | null
          favorite_game_id: string | null
          games_played: number | null
          losses: number | null
          user_id: string | null
          win_percentage: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "game_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "game_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_conversation_summaries: {
        Row: {
          conversation_id: string | null
          is_favorite: boolean | null
          last_message: string | null
          last_message_at: string | null
          last_message_media_type: string | null
          member_count: number | null
          title: string | null
          unread_count: number | null
          viewer_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_feed_view: {
        Row: {
          author_avatar_url: string | null
          author_full_name: string | null
          author_id: string | null
          author_trust_level: Database["public"]["Enums"]["trust_level"] | null
          body: string | null
          created_at: string | null
          id: string | null
          media_url: string | null
        }
        Relationships: []
      }
      messages_plain: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string | null
          encrypted_keys: Json | null
          game_invitation_id: string | null
          id: string | null
          is_deleted: boolean | null
          is_encrypted: boolean | null
          iv: string | null
          media_type: string | null
          media_url: string | null
          reply_to_id: string | null
          sender_id: string | null
        }
        Insert: {
          body?: never
          conversation_id?: string | null
          created_at?: string | null
          encrypted_keys?: Json | null
          game_invitation_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_encrypted?: boolean | null
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Update: {
          body?: never
          conversation_id?: string | null
          created_at?: string | null
          encrypted_keys?: Json | null
          game_invitation_id?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_encrypted?: boolean | null
          iv?: string | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "group_conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages_plain"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "starred_messages_view"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      starred_messages_view: {
        Row: {
          body: string | null
          conversation_id: string | null
          conversation_title: string | null
          encrypted_keys: Json | null
          is_encrypted: boolean | null
          iv: string | null
          media_type: string | null
          media_url: string | null
          message_created_at: string | null
          message_id: string | null
          sender_avatar_url: string | null
          sender_full_name: string | null
          sender_id: string | null
          starred_at: string | null
          starred_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "group_conversation_summaries"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starred_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "starred_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "starred_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories_feed: {
        Row: {
          author_avatar_url: string | null
          author_full_name: string | null
          author_id: string | null
          background_color: string | null
          caption: string | null
          comment_count: number | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          love_count: number | null
          loved_by_me: boolean | null
          media_type: string | null
          media_url: string | null
          viewed_by_me: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "conversation_summaries"
            referencedColumns: ["other_user_id"]
          },
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "live_feed_view"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_contact_by_phone: {
        Args: { p_owner_id: string; p_phone: string }
        Returns: undefined
      }
      can_view_story: {
        Args: { p_story_id: string; p_viewer?: string }
        Returns: boolean
      }
      create_game_invitation: {
        Args: {
          p_game_key: string
          p_recipient_email?: string
          p_recipient_id?: string
        }
        Returns: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          game_id: string
          id: string
          invitation_token: string
          match_id: string | null
          recipient_email: string | null
          recipient_id: string | null
          sender_id: string
          status: Database["public"]["Enums"]["game_invitation_status"]
        }
        SetofOptions: {
          from: "*"
          to: "game_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_group_conversation: {
        Args: { p_member_ids: string[]; p_title: string }
        Returns: string
      }
      credit_wallet_from_webhook: {
        Args: {
          p_amount_minor: number
          p_description?: string
          p_provider_ref: string
          p_user_id: string
        }
        Returns: undefined
      }
      decline_payment_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      delete_message_for_everyone: {
        Args: { p_message_id: string }
        Returns: {
          body: string | null
          conversation_id: string
          created_at: string
          encrypted_keys: Json
          game_invitation_id: string | null
          id: string
          is_deleted: boolean
          is_encrypted: boolean
          iv: string | null
          media_type: string | null
          media_url: string | null
          reply_to_id: string | null
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_match: {
        Args: { p_is_draw?: boolean; p_match_id: string; p_winner_id?: string }
        Returns: {
          ai_difficulty: Database["public"]["Enums"]["ai_difficulty"] | null
          board_state: Json
          created_at: string
          created_by: string
          current_turn_player_id: string | null
          ended_at: string | null
          game_id: string
          id: string
          is_private: boolean
          match_token: string
          mode: Database["public"]["Enums"]["match_mode"]
          result: Database["public"]["Enums"]["match_result"] | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "game_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fulfill_payment_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      get_or_create_direct_conversation: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: string
      }
      is_conversation_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_match_participant: {
        Args: { p_match_id: string; p_user_id: string }
        Returns: boolean
      }
      join_match: {
        Args: { p_match_id: string }
        Returns: {
          ai_difficulty: Database["public"]["Enums"]["ai_difficulty"] | null
          board_state: Json
          created_at: string
          created_by: string
          current_turn_player_id: string | null
          ended_at: string | null
          game_id: string
          id: string
          is_private: boolean
          match_token: string
          mode: Database["public"]["Enums"]["match_mode"]
          result: Database["public"]["Enums"]["match_result"] | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "game_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      nextgen_get_msg_key: { Args: never; Returns: string }
      nextgen_msg_decrypt: { Args: { p_cipher: string }; Returns: string }
      nextgen_msg_encrypt: { Args: { p_plain: string }; Returns: string }
      set_transaction_pin: { Args: { p_pin: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transfer_funds: {
        Args: {
          p_amount_minor: number
          p_description?: string
          p_from: string
          p_to: string
        }
        Returns: undefined
      }
      verify_transaction_pin: { Args: { p_pin: string }; Returns: boolean }
    }
    Enums: {
      account_type: "individual" | "business" | "admin"
      ai_difficulty: "easy" | "medium" | "hard"
      call_direction: "incoming" | "outgoing"
      call_status: "answered" | "missed" | "declined"
      conversation_kind: "direct" | "group"
      game_invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      match_mode: "pvp" | "pvai" | "local"
      match_result:
        | "win"
        | "loss"
        | "draw"
        | "stalemate"
        | "resigned"
        | "timeout"
        | "abandoned"
      match_status:
        | "waiting"
        | "active"
        | "completed"
        | "declined"
        | "expired"
        | "cancelled"
      order_status:
        | "pending"
        | "paid"
        | "shipped"
        | "completed"
        | "cancelled"
        | "refunded"
      trust_level:
        | "unverified"
        | "verified_identity"
        | "verified_business"
        | "high_assurance"
        | "risk_detected"
      wallet_tx_type: "credit" | "debit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["individual", "business", "admin"],
      ai_difficulty: ["easy", "medium", "hard"],
      call_direction: ["incoming", "outgoing"],
      call_status: ["answered", "missed", "declined"],
      conversation_kind: ["direct", "group"],
      game_invitation_status: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      match_mode: ["pvp", "pvai", "local"],
      match_result: [
        "win",
        "loss",
        "draw",
        "stalemate",
        "resigned",
        "timeout",
        "abandoned",
      ],
      match_status: [
        "waiting",
        "active",
        "completed",
        "declined",
        "expired",
        "cancelled",
      ],
      order_status: [
        "pending",
        "paid",
        "shipped",
        "completed",
        "cancelled",
        "refunded",
      ],
      trust_level: [
        "unverified",
        "verified_identity",
        "verified_business",
        "high_assurance",
        "risk_detected",
      ],
      wallet_tx_type: ["credit", "debit"],
    },
  },
} as const
