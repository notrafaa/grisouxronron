# Squeechie Cats

Jeu Next.js/Vercel de farm clicker avec pseudo unique, choix de chat, sauvegarde Supabase, upgrades, sons WebAudio et classement.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvre `http://localhost:3000`.

Sans variables Supabase, le site passe en mode demo avec `localStorage`. C'est pratique pour tester l'interface.

## Brancher Supabase

1. Cree un projet Supabase.
2. Dans Supabase, active `Authentication > Sign In / Providers > Anonymous sign-ins`.
3. Ouvre `SQL Editor` et execute le contenu de `supabase/schema.sql`.
4. Copie `.env.example` vers `.env.local`.
5. Renseigne:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ton-anon-key
```

Le pseudo est unique grace a un index SQL sur `lower(username)`, donc `Milo` et `milo` ne peuvent pas exister en double.

## Deployer sur Vercel

Ajoute les memes variables dans `Project Settings > Environment Variables`, puis deploie normalement le repo Next.js.

## Remplacer les chats

Les images temporaires sont ici:

```txt
public/cats/grisou.png
public/cats/ronron.png
```

Tu peux les remplacer par tes fichiers IA en gardant les memes noms, ou modifier les chemins dans `src/app/page.tsx`.
