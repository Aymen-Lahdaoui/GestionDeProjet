# 🚀 Application de Gestion de Projets

Une application complète et moderne de gestion de projet construite avec **ASP.NET Core 8.0** et une interface **Premium**. Elle permet de gérer les équipes, les projets, les tâches et la communication en temps réel, avec un système d'authentification sécurisé.

## ✨ Fonctionnalités Principales

### 🔐 Authentification & Sécurité
- **Inscription & Connexion** : Système sécurisé avec JWT (JSON Web Tokens).
- **Rôles & Permissions** : 
  - **Admin** : Accès complet, gestion des utilisateurs et suppression.
  - **Sous-Admin** : Gestion complète sauf la suppression des Admins.
  - **Chef de Projet** : Gestion des projets et tâches assignés.
  - **Utilisateur** : Accès en lecture/écriture limité à ses tâches.
- **Double Authentification (2FA)** : Support optionnel pour une sécurité accrue.

### 📊 Gestion de Projet
- **Tableau de Bord** : Vue d'ensemble avec statistiques et graphiques.
- **Projets** : Création, suivi, attribution à des équipes, deadlines.
- **Tâches** : Kanban/Liste, priorités, statuts, assignation multiple.
- **Calendrier** : Vue mensuelle/hebdomadaire des échéances.

### 👥 Collaboration
- **Équipes** : Gestion des membres et des rôles au sein de l'équipe.
- **Chat & Commentaires** : Discussions en temps réel sur les projets et tâches.
- **Profils Utilisateurs** : Page de profil personnalisable (Avatar, Infos).

### 🎨 Design Premium
- **Interface UI/UX** : Design moderne "Glassmorphism" et "Neumorphism".
- **Thèmes** : Support natif du Mode Sombre (Dark Mode) et Clair.
- **Intéractivité** : Animations fluides et transitions soignées.

---

## 🛠 Technologies Utilisées

- **Backend** : ASP.NET Core 8.0 Web API
- **Base de Données** : Microsoft SQL Server (LocalDB) avec Entity Framework Core
- **Frontend** : HTML5, CSS3 (Variables & Animations), JavaScript (ES6+)
- **Sécurité** : ASP.NET Identity, JWT Bearer Authentication

---

## 🚀 Installation et Démarrage

### Prérequis
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [SQL Server LocalDB](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb) (Inclus avec Visual Studio)

### Étapes

1. **Cloner le projet**
   ```bash
   git clone <votre-repo>
   cd ProjectManager
   ```

2. **Configurer la Base de Données**
   Assurez-vous que la chaîne de connexion dans `appsettings.json` est correcte pour votre environnement LocalDB.
   Puis appliquez les migrations :
   ```bash
   dotnet ef database update
   ```

3. **Lancer l'application**
   ```bash
   dotnet run
   ```

4. **Accéder à l'application**
   Ouvrez votre navigateur sur : `http://localhost:5000`

---

## 🔑 Identifiants par Défaut (Seed Data)

Lors du premier lancement, un compte administrateur est créé automatiquement :

- **Email** : `admin@example.com`
- **Mot de passe** : `Admin123!`

> **Note** : Il est recommandé de changer ce mot de passe immédiatement après la première connexion via la page "Paramètres".

---

## 📂 Structure du Projet

```
ProjectManager/
├── Controllers/          # API Controllers (Auth, Tasks, Projects...)
├── Models/              # Classes Entités (EF Core) & DTOs
├── Data/                # DbContext & Migrations
├── Services/            # Logique métier (EmailService...)
├── wwwroot/             # Frontend (HTML, CSS, JS)
│   ├── index.html       # SPA Single Page Application
│   ├── login.html       # Pages d'auth
│   ├── styles.css       # Design System & Thèmes
│   └── app.js           # Logique Frontend
└── appsettings.json     # Config (Connexion DB, JWT Key)
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue pour discuter des changements majeurs avant de soumettre une Pull Request.

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

