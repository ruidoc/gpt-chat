create table if not exists users (
  id char(36) primary key default (uuid()),
  email varchar(191) not null unique,
  name varchar(191) null,
  password_hash varchar(100) not null,
  status enum('active', 'disabled') not null default 'active',
  created_at datetime(3) not null default current_timestamp(3),
  last_login_at datetime(3) null
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table if not exists chat_threads (
  id varchar(64) primary key,
  user_id char(36) not null,
  title varchar(255) not null default '新聊天',
  model_name varchar(100) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  deleted_at datetime(3) null,
  constraint fk_chat_threads_user
    foreign key (user_id) references users(id) on delete cascade,
  index idx_chat_threads_user_updated (user_id, updated_at),
  index idx_chat_threads_user_deleted (user_id, deleted_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;

create table if not exists chat_messages (
  id char(36) primary key default (uuid()),
  thread_id varchar(64) not null,
  user_id char(36) not null,
  seq int not null,
  role enum('system', 'user', 'assistant', 'tool') not null,
  content_json json not null,
  created_at datetime(3) not null default current_timestamp(3),
  unique key uniq_chat_messages_thread_seq (thread_id, seq),
  index idx_chat_messages_thread_seq (thread_id, seq),
  index idx_chat_messages_user_created (user_id, created_at),
  constraint fk_chat_messages_thread
    foreign key (thread_id) references chat_threads(id) on delete cascade,
  constraint fk_chat_messages_user
    foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci;
