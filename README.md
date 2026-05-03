# Quadro de Avisos da Turma

Exemplo simples de SaaS para demonstração em aula. A aplicação mostra um pequeno sistema de avisos no navegador, com um painel do professor para publicar recados e um painel do aluno para consumir o software pronto.

## O que este exemplo ensina

- acesso por navegador, sem instalação local
- dados centralizados quando conectado a um backend em nuvem
- atualização do mesmo sistema para vários usuários
- diferença entre um modo local e um modo SaaS

## Estrutura

- `index.html`: interface principal
- `style.css`: visual da demonstração
- `app.js`: lógica do painel
- `config.js`: configuração local do projeto

## Como testar agora

1. Abra `index.html` no navegador.
2. Use o PIN `1234`.
3. Clique em `Carregar exemplo`.
4. Clique em `Publicar aviso`.

Sem configurar a nuvem, o projeto funciona em `modo local de demonstração`.

## Como transformar em SaaS com Supabase

Esta etapa deixa o exemplo realmente centralizado, pronto para demonstrar a natureza do SaaS.

### 1. Criar um projeto no Supabase

Crie uma conta gratuita em `https://supabase.com` e depois um novo projeto.

### 2. Criar a tabela

No SQL Editor do Supabase, execute:

```sql
create table if not exists announcements (
  id bigint generated always as identity primary key,
  title text not null,
  message text not null,
  audience text not null default 'Todos',
  created_at timestamptz not null default now()
);
```

### 3. Configurar para a demonstração

Para este exemplo didático ficar muito simples, você pode desativar o RLS da tabela:

```sql
alter table announcements disable row level security;
```

Isso é adequado para uma aula demonstrativa, mas não para produção.

### 4. Copiar as credenciais

No Supabase, abra `Project Settings > API` e copie:

- `Project URL`
- `anon public key`

### 5. Atualizar o arquivo `config.js`

Edite `config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_ANON",
  professorPin: "1234"
};
```

Quando essas duas credenciais estiverem preenchidas, o app muda automaticamente para `Modo nuvem ativo`.

## Como publicar na Vercel

1. Entre na sua conta da Vercel.
2. Crie um novo projeto importando esta pasta.
3. Como o projeto é estático, não precisa configuração especial de build.
4. Depois do deploy, abra a URL gerada.

## Sugestão de demonstração em sala

1. Abra o app no computador do professor.
2. Abra a mesma URL no celular ou em outro navegador.
3. Publique um aviso no painel do professor.
4. Clique em `Atualizar painel` no segundo dispositivo.
5. Explique: o software é único, está na internet e os dados estão centralizados.

## Observação importante

Este projeto foi simplificado para ter alto valor didático e baixa complexidade.

- O `PIN do professor` é apenas uma proteção visual para demonstração.
- Em produção, o ideal seria usar autenticação real e políticas seguras de acesso.
