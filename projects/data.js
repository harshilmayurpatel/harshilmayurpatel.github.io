/* =========================================================
   All projects: the single source of truth for /projects/.
   To add a project, add one object here. Screenshots go in
   projects/img/<slug>/ and are listed in `shots` (optional).
   ========================================================= */
window.PROJECTS = [
  {
    slug: "ask-my-ai",
    title: "Ask my AI",
    tagline: "A RAG assistant on this site that answers recruiters' questions about me, and lets the voice mic understand free-form sentences.",
    category: "ai",
    tags: ["LangChain", "FAISS", "FastAPI", "Llama 3.3", "Docker", "RAG"],
    badges: ["new", "featured"],
    preview: "chat",
    links: {
      code: "https://github.com/harshilmayurpatel/ask-harshil-api"
    },
    stats: [["19/19", "retrieval checks"], ["2", "AI endpoints"], ["$0", "to run"]],
    caseStudy: {
      problem: "Recruiters skim a portfolio in under a minute and leave with questions the page doesn't answer. Separately, the site's voice mic only understood exact keyword commands.",
      built: "A retrieval-augmented generation (RAG) service with two endpoints: /chat streams grounded answers about my background, and /intent maps spoken sentences like \"can you make it darker\" to site actions.",
      how: [
        "My resume and project notes are curated into Markdown, split one chunk per section, embedded locally with FastEmbed (bge-small) and indexed in FAISS.",
        "Each question retrieves the top 4 chunks; Llama 3.3 70B on Groq answers only from them and says \"I don't know\" otherwise.",
        "Answers stream word by word over Server-Sent Events from a FastAPI app packaged in Docker for Hugging Face Spaces.",
        "Safeguards: CORS limited to this site, per-visitor rate limits, length caps, a prompt-injection guard, and an offline fallback that returns the best-matching facts."
      ],
      results: [
        "19 of 19 retrieval test questions find the right section of my notes.",
        "The intent model can only choose from a fixed list of site actions, validated on the server.",
        "Runs entirely on free tiers: local embeddings, Groq's free API, and Hugging Face Spaces."
      ],
      role: "Solo project: knowledge base, retrieval pipeline, API, evaluation, Docker deployment and the chat UI on this site."
    },
    shots: []
  },
  {
    slug: "nba-analysis",
    title: "NBA 2024–25 Data Scraping & Statistical Analysis",
    tagline: "An automated pipeline that scrapes real-time NBA statistics and turns them into 18+ visualizations of performance trends.",
    category: "data",
    tags: ["Python", "BeautifulSoup", "Pandas", "Matplotlib", "Seaborn", "Streamlit"],
    badges: ["featured"],
    preview: "bars",
    links: {
      code: "https://github.com/harshilmayurpatel/Data-Scrapping"
    },
    stats: [["18+", "visualizations"], ["80%", "less redundancy"], ["<30s", "runtime"]],
    caseStudy: {
      problem: "Season statistics are spread across web pages, and pulling them by hand for analysis is slow and repetitive.",
      built: "A Python scraper built collaboratively with Requests and BeautifulSoup that extracts real-time NBA data, plus an analysis layer and a Streamlit app to explore it.",
      how: [
        "Requests and BeautifulSoup fetch and parse the stats tables into structured records.",
        "Pandas cleans and reshapes the data for analysis.",
        "Matplotlib and Seaborn produce 18+ visualizations of performance trends and statistical insights.",
        "The steps are modular, so each stage can be rerun or reused on its own."
      ],
      results: [
        "Modular automation cut redundancy by over 80%.",
        "The full pipeline runs in under 30 seconds.",
        "The work was presented at ICERI as \"Web Scraping and Data Analysis using BeautifulSoup\"."
      ],
      role: "Collaborative project: scraping pipeline, data processing and visualizations."
    },
    shots: []
  },
  {
    slug: "ev-market",
    title: "Electric Vehicle Market Analysis",
    tagline: "An interactive Tableau dashboard on U.S. EV adoption: growth trends, state-level maps and BEV vs. PHEV mix.",
    category: "data",
    tags: ["Tableau", "Excel", "Data Cleaning", "KPIs"],
    badges: ["featured"],
    preview: "map",
    links: {
      code: "https://github.com/harshilmayurpatel/Electric-Vehicle-Data-Analysis"
    },
    stats: [["KPI", "tracking"], ["State", "-level maps"], ["BEV/PHEV", "comparison"]],
    caseStudy: {
      problem: "EV adoption data is large and uneven across states, which makes trends hard to see in raw tables.",
      built: "An interactive Tableau dashboard that tracks EV adoption across the U.S. over time and by state.",
      how: [
        "Cleaned and prepared the vehicle registration data in Excel before loading it into Tableau.",
        "Built KPI tiles for headline numbers, a growth-over-time trend, and state-level adoption maps.",
        "Compared battery electric (BEV) and plug-in hybrid (PHEV) distribution side by side.",
        "Added filters so viewers can drill into a state or a vehicle type."
      ],
      results: [
        "One dashboard answers where EV adoption is growing, how fast, and which EV types lead.",
        "Published on Tableau Public for anyone to explore."
      ],
      role: "Solo project: data cleaning, dashboard design and storytelling."
    },
    shots: []
  },
  {
    slug: "sokoban",
    title: "AI Puzzle Solver: Sokoban",
    tagline: "A retro Sokoban game with a built-in solver. Watch DFS, BFS or A* solve the level, or ask for a hint.",
    category: "web",
    tags: ["JavaScript", "DFS", "BFS", "A*", "Search Algorithms"],
    badges: ["featured", "live"],
    preview: "path",
    links: {
      demo: "https://harshilmayurpatel.github.io/Sokoban-AI-Solver/",
      code: "https://github.com/harshilmayurpatel/Sokoban-AI-Solver"
    },
    stats: [["3", "search algorithms"], ["▶", "playable in browser"]],
    caseStudy: {
      problem: "Sokoban puzzles explode combinatorially: a few boxes create thousands of reachable states, and one wrong push can make a level unsolvable.",
      built: "A browser Sokoban game with an AI solver that powers a hint button and a watch-the-AI-solve mode.",
      how: [
        "Each game state (player position plus box positions) is a node in a search graph.",
        "Depth-First Search finds valid solution paths, with Breadth-First Search and A* available for comparison.",
        "Deadlock pruning skips states where a box can never reach a goal, such as a box pushed into a corner.",
        "The hint system runs the solver from the current position and suggests the next move."
      ],
      results: [
        "Playable in the browser on desktop and mobile.",
        "Shows how search strategy changes speed and path length on the same puzzle."
      ],
      role: "Solo project: game, level design, solver and hint system."
    },
    shots: [
      { src: "img/sokoban/title.webp", alt: "Sokoban title screen: pixel-art logo, AI puzzle solver subtitle and Press Start button", caption: "Title screen of the browser game" }
    ]
  },
  {
    slug: "travel-buddy",
    title: "Travel Buddy",
    tagline: "An Android app that helps tourists navigate, calculate distances and plan routes in real time.",
    category: "mobile",
    tags: ["Android Studio", "Java", "Google Maps API"],
    badges: [],
    preview: "route",
    links: {},
    stats: [],
    caseStudy: {
      problem: "Tourists in a new city juggle several apps to find places, judge distances and plan a route.",
      built: "An Android app that brings navigation, distance calculation and real-time route information into one simple interface.",
      how: [
        "Built in Android Studio with Java.",
        "Integrated the Google Maps API for location tracking and dynamic travel planning.",
        "Kept the interface simple, with efficient data handling for smooth use on the go."
      ],
      results: [
        "Visitors can see where they are, how far a place is, and how to get there in one app."
      ],
      role: "App design and development."
    },
    shots: []
  },
  {
    slug: "vr-games",
    title: "VR Game Development",
    tagline: "Immersive multiplayer VR games, Spaceship Shooting and Tennis, with physics-based interaction and AI opponents.",
    category: "mobile",
    tags: ["Unity3D", "C#", "Blender", "VR"],
    badges: [],
    preview: "vr",
    links: {},
    stats: [["2", "multiplayer games"]],
    caseStudy: {
      problem: "VR games have to feel physically real and stay smooth: dropped frames break immersion and can cause motion sickness.",
      built: "Two multiplayer VR games, Spaceship Shooting and Tennis, built in Unity3D with C# and assets modeled in Blender.",
      how: [
        "Realistic physics-based interactions for hits, throws and collisions.",
        "AI-driven opponents for single-player matches.",
        "Optimized rendering performance and frame rates for a smoother VR experience."
      ],
      results: [
        "Two complete multiplayer games with physics and AI opponents."
      ],
      role: "Game development: gameplay, physics, opponent AI and performance tuning."
    },
    shots: []
  },
  {
    slug: "portfolio",
    title: "This portfolio",
    tagline: "A hand-built site that tells my career as a data pipeline, with voice navigation, a Dynamic Island and a ripple theme switch.",
    category: "web",
    tags: ["HTML", "CSS", "JavaScript", "Web Speech API", "View Transitions"],
    badges: ["live"],
    preview: "pipeline",
    links: {
      demo: "../",
      code: "https://github.com/harshilmayurpatel/harshilmayurpatel.github.io"
    },
    stats: [["0", "frameworks"], ["5", "pipeline stages"]],
    caseStudy: {
      problem: "Most portfolios look the same. I wanted one that shows how I think about data while staying fast, minimal and accessible.",
      built: "A static site in plain HTML, CSS and JavaScript, organized as a pipeline: Ingest, Process, Build, Stack, Deploy.",
      how: [
        "A scroll-synced side rail fills each stage's ring as you read.",
        "Dark mode switches with a double-ripple View Transition from the toggle.",
        "Voice navigation with the Web Speech API, backed by the Ask my AI intent model for free-form sentences.",
        "A Dynamic Island shows status, plus haptics on phones and a weather greeting in \"Surprise me\"."
      ],
      results: [
        "No framework and no build step, deployed on GitHub Pages.",
        "Respects reduced motion, works with the keyboard, and adapts to phones."
      ],
      role: "Solo project: design and development."
    },
    shots: [
      { src: "img/portfolio/home-dark.webp", alt: "Portfolio home page in dark mode with the pipeline rail, name, photo and assistant buttons", caption: "Home page in dark mode" }
    ]
  }
];

window.PROJECT_CATEGORIES = [
  ["all", "All"],
  ["ai", "AI & ML"],
  ["data", "Data & Analytics"],
  ["web", "Web & Games"],
  ["mobile", "Mobile & VR"]
];
