export default (h) => {
  const { id, item, p, doc, link, picture, video, img, shots, a } = h
  const configCode = h.code.configCode
    .replace('// Pole pro editora, typovaný obsah pro web.', '// Fields for the editor, typed content for the website.')
    .replace('/aktuality/:slug', '/news/:slug')
  const pageCode = h.code.pageCode
    .replace('// news má typ News, odvozený z cms.config.ts', '// news is typed as News, inferred from cms.config.ts')

  return {
    pages: {
      home: {
        title: 'Home', slug: 'home',
        sections: [
          {
            id: id(), type: 'hero', eyebrow: null,
            heading: 'Feel at home editing your website.',
            text: 'We build your website together with you. It comes with tinyzoo: an admin area in your language where you write articles, put pages together and publish content.\nWe want it to feel like calm, pleasant work. Try the demo and tell us how you get on.',
            primaryLabel: 'Try the admin area', primaryUrl: '/en/demo',
            secondaryLabel: 'Share your thoughts', secondaryUrl: '/en/feedback',
            video: video.link, image: null,
          },
          {
            id: id(), type: 'features', eyebrow: null,
            heading: 'Everything you need is close at hand.',
            text: 'Write a news post, update a page or read a message from your website. The admin area speaks English, Czech and German and works on your phone too.',
            items: [
              item({ title: 'Text, pictures and links', text: 'Write with headings and lists. Add a description to a picture and choose what stays visible when it is cropped. Find a link by the page title.', animal: 'bunny' }),
              item({ title: 'A page that fits your needs', text: 'Choose ready-made page sections: cards, questions and answers, or a video. Drag them into order. See the preview alongside, including a phone view.', animal: 'elephant' }),
              item({ title: 'Work on an article together', text: 'Write in the same article as a colleague. See where the other person is typing. Your changes will not overwrite each other.', animal: 'octopus' }),
              item({ title: 'One more check before publishing', text: 'Missing a required detail or a picture description? The admin area lets you know and takes you straight to where you can add it.', animal: 'bird' }),
              item({ title: 'Publish when you are ready', text: 'Publish an article straight away or choose a day and time. Version history lets you go back to an earlier version.', animal: 'frog' }),
              item({ title: 'Website messages in one place', text: 'Find form messages in the admin area. An email lets you know when one arrives. You can also download messages as a spreadsheet for Excel.', animal: 'fox' }),
            ],
          },
          {
            id: id(), type: 'showcase', eyebrow: null,
            heading: 'Four small tasks from an ordinary day.',
            text: 'These short videos show the admin area in use. You can then try the same tasks yourself.',
            items: [
              item({ title: 'Add a link by the page title', text: 'Select some words and search for the page you want to link to. There is no need to copy its address.', video: video.link }),
              item({ title: 'Read a message from your website', text: 'A visitor fills in a form and the message appears in the admin area. An email lets you know it has arrived.', video: video.form }),
              item({ title: 'Edit an article or start with a copy', text: 'Browse the article list, open an article and edit it. You can also start a new article by copying an existing one.', video: video.duplicate }),
              item({ title: 'Add a second level to the menu', text: 'Place a page under another menu item. Visitors will then find it in a drop-down menu on your website.', video: video.menu }),
            ],
          },
          {
            id: id(), type: 'steps', eyebrow: null,
            heading: 'From planning together to writing your article.',
            items: [
              item({ title: 'We plan and build your website together', text: 'We talk through what your website needs to do and which content you will be changing. Then we build it around those needs.' }),
              item({ title: 'You get your own admin area', text: 'In tinyzoo you will find your pages, articles and picture library. This is where you look after your website content.' }),
              item({ title: 'Write and watch the preview', text: 'Add text and pictures, or put a page together from ready-made sections. See how it looks in the preview before you publish.' }),
              item({ title: 'Publish at the right time for you', text: 'Fill in any missing details and publish your finished content. Or choose the day and time it should appear on your website.' }),
            ],
          },
          {
            id: id(), type: 'cta', heading: 'Try editing an article of your own.',
            text: 'Feel free to experiment in the demo admin area. We reset it every night. Your thoughts help us choose what to improve next.',
            primaryLabel: 'Open the demo', primaryUrl: '/en/demo', secondaryLabel: 'Tell us how it went', secondaryUrl: '/en/feedback', animal: 'fox',
          },
          {
            id: id(), type: 'faq', heading: 'Before you start editing',
            text: 'A few answers to questions you may have.',
            items: [
              item({ question: 'Do I need training first?', answer: 'You can open the demo and try writing your first article straight away. The demo page has a few specific tasks to try. If you lose your way, please tell us.' }),
              item({ question: 'Can I break anything while trying it?', answer: 'The demo admin area is there for you to experiment. We reset it every night, so you cannot break anything permanently. Your changes will not stay there either. On your own website, you can preview unfinished content before publishing.' }),
              item({ question: 'What if two of us edit the same article?', answer: 'You can write in it at the same time. Each of you can see where the other is typing, and your changes will not overwrite each other.' }),
              item({ question: 'Can I go back to an earlier version?', answer: 'Yes. Version history lets you restore an earlier version of your content.' }),
              item({ question: 'How do I quickly find an older article?', answer: 'Press ⌘K (Ctrl+K on Windows) or click Search and type any word from the article. Search finds drafts too and copes with typos.' }),
              item({ question: 'Does the admin area work on a phone?', answer: 'Yes, you can edit content on your phone too. You can also switch the page preview to a phone view to see how it will look to visitors. We also plan a separate mobile app.' }),
              item({ question: 'Is tinyzoo finished? Can I try it yet?', answer: 'Yes. Version 1.0 came out in November 2026, and the demo is open to everyone. It resets every night. tinyzoo has over 1,600 automated tests, and we went through all the usual editing tasks in it in detail. We look after development and fixes ourselves.' }),
              item({ question: 'What if I need something extra?', answer: 'Tell us what you need to do on your website. We do not have a catalogue of ready-made add-ons. We build extra features for individual websites.' }),
            ],
          },
        ],
        metaDescription: 'tinyzoo is a friendly admin area for your website. Write articles, build pages and preview your content. Try the demo and tell us how you get on.',
      },
      plany: {
        title: 'Roadmap', slug: 'roadmap',
        sections: [
          {
            id: id(), type: 'roadmap', eyebrow: null,
            heading: 'What’s ready and what’s coming.',
            text: 'Your feedback from trying the demo or editing your website helps us decide what to work on next.',
            note: 'Tell us what takes the most time when you look after your website.',
          },
          {
            id: id(), type: 'cta', heading: 'What would help you?',
            text: 'Try the tinyzoo demo or tell us what you need when editing your website. Your experience will help us choose the next steps.',
            primaryLabel: 'Try the demo', primaryUrl: '/en/demo', secondaryLabel: 'Tell us what you need', secondaryUrl: '/en/feedback', animal: 'fox',
          },
        ],
        metaDescription: 'See what tinyzoo can already do and what version 1.0 means for your website. Find out what’s coming in 1.1 and beyond.',
      },
      demo: {
        title: 'Try the admin area', slug: 'demo',
        sections: [{
          id: id(), type: 'demo', heading: 'Try editing a website.',
          text: 'The demo is open to everyone. Sign in with the details on this page and start editing. We reset it every night, so you cannot break anything permanently. Your work will not stay here either. Here are a few tasks to get you started.',
          tips: [
            item({ text: 'Write a short news post with a heading and a list. Add a picture and its description, then choose which part should stay visible when it is cropped.' }),
            item({ text: 'Select a few words and add a link. Find the page you want to link to by its title.' }),
            item({ text: 'Add a ready-made section to a page and drag it into place. Check the preview in the phone view too.' }),
            item({ text: 'Prepare an article and schedule it to go live tomorrow morning.' }),
            item({ text: 'Open the same article in two windows. Take turns typing in each and watch where the changes appear.' }),
            item({ text: 'Find the messages from a website form and download them as a spreadsheet for Excel.' }),
          ],
        }],
        metaDescription: 'Try the tinyzoo admin area. Write a news post, edit a page and check the preview. We reset the demo every night.',
      },
      'zpetna-vazba': {
        title: 'Feedback', slug: 'feedback',
        sections: [{
          id: id(), type: 'feedback', heading: 'How did you get on with tinyzoo?',
          text: 'Tell us what felt easy, where you got stuck or what was missing. Even a small observation from a single task helps. Your experience helps us choose what to improve next.',
        }],
        metaDescription: 'Tried tinyzoo? Tell us what went well while editing and where you got stuck.',
      },
      'pro-vyvojare': {
        title: 'For developers', slug: 'developers',
        sections: [
          {
            id: id(), type: 'hero', eyebrow: null,
            heading: 'Content management inside Nuxt.',
            text: 'We build client websites in Nuxt. Each website also needs a place where the client can look after content. That is why we are developing tinyzoo: a CMS with a TypeScript model and an admin area in Czech, English or German.\nThe website and content management run in one application. One project, one deployment.',
            primaryLabel: 'Try the admin area', primaryUrl: '/en/demo',
            secondaryLabel: 'What\'s coming', secondaryUrl: '/en/roadmap',
            video: video.duplicate, image: null,
          },
          {
            id: id(), type: 'code', eyebrow: null,
            heading: 'Start with the content your website needs.',
            text: 'Define articles, page blocks and forms in cms.config.ts. The model generates the admin area. A generated client file carries the types through to your Vue templates. tinyzoo is a Nuxt layer and module that runs directly in your application.',
            files: [item({ name: 'cms.config.ts', code: configCode }), item({ name: 'pages/news/[slug].vue', code: pageCode })],
            chips: 'defineEntity(), defineBlock(), definePages(), defineForm(), f.list()',
          },
          {
            id: id(), type: 'steps', eyebrow: null,
            heading: 'From the first command to managing content.',
            items: [
              item({ title: 'Create a project', text: 'The pnpm create tinyzoo command asks for the languages, the parts of the site and the demo content, and sets up the project foundation. Carry on building your website in Nuxt.', command: 'pnpm create tinyzoo' }),
              item({ title: 'Define the content', text: 'Describe the content your client will edit in cms.config.ts. Their admin area is generated from the model.', command: 'pnpm db:generate' }),
              item({ title: 'Deploy the application', text: 'tinyzoo uses Node and Postgres. We deploy with Pushbase. The website and admin area deploy together.', command: 'pnpm build' }),
              item({ title: 'Walk through the website with your client', text: 'Try editing content, using the live preview and scheduling publication together. It is a chance to see how the content setup works for your client.' }),
            ],
          },
          {
            id: id(), type: 'faq', heading: 'Developer questions',
            items: [
              item({ question: 'What does tinyzoo already include?', answer: 'Pages built from blocks, lists within blocks and forms. Also menus with subitems, redirects, SEO fields and translations. The media library generates images in the sizes you need on demand. Editing includes a live preview, real-time collaborative writing, scheduled publishing and version history. Visitors and editors can search the content, and search copes with typos.' }),
              item({ question: 'What if we need something extra?', answer: 'We write extra features as custom modules in code. Tell us what your website needs. Together we can work out how to extend it.' }),
              item({ question: 'How do we access the content?', answer: 'Content is stored in standard Postgres tables. There is also a content API described in OpenAPI. In Vue templates, you work with types from the generated client file.' }),
              item({ question: 'Who handles maintenance?', answer: 'We handle development and fixes ourselves. We update one package across our websites. tinyzoo is young. Over 1,600 automated tests and a detailed check of all the usual editing tasks help us verify how it works. We will gather more experience as people use it.' }),
            ],
          },
          {
            id: id(), type: 'cta', heading: 'See the website through an editor’s eyes.',
            text: 'Try editing an article and checking the preview. Then tell us how you got on and what you would need for your own website.',
            primaryLabel: 'Try the admin area', primaryUrl: '/en/demo', secondaryLabel: 'Share your thoughts', secondaryUrl: '/en/feedback', animal: 'frog',
          },
        ],
        metaDescription: 'tinyzoo for Nuxt websites: a TypeScript content model, an admin area in Czech, English or German, and types through to Vue templates. Explore the content model and API.',
      },
    },
    news: {
      'role-na-miru': {
        title: 'Custom roles, and fields only some people can change', slug: 'custom-roles',
        perex: 'Besides administrator, editor and author, your website can have roles of its own, such as a translator. For each field you decide who may change it.',
        clip: { video: video.roles, caption: 'What each role can do, and the invitation with role descriptions' },
        body: doc(p('Your developer sets up roles to match who does what in your team. A translator might edit only articles and publish nothing. Someone who looks after the authors manages their profiles and has no access to the media library.'),
          p('A field only some people can change has a grey background and a lock. Below it, the admin area says who can change it, so you know whom to ask.'),
          p('You will find the overview in Team:'),
          picture(shots.rolesOverview, 'What can each role do? in Team: a table of roles with what each one edits, what it can only read, whether it publishes and which files it can reach'),
          p('And this is the invitation, with one sentence about each role:'),
          picture(shots.invite, 'Inviting someone: the list of roles, each with one sentence about what it can do'),
          p('In Team you will find What can each role do?. When you invite someone or change their role, each role comes with one sentence about what it can do.'),
          p('What each role can do, and what to do about a locked field, is in the ', a('Roles and permissions', '/en/docs/editors/roles-and-permissions'), ' chapter of the editors’ guide.')),
      },
      'jazyky-zvlast': {
        title: 'Each language is published on its own, with the original at hand', slug: 'languages-on-their-own',
        perex: 'Finish the English version of an article at your own pace and publish it when it is ready. While you translate, the original text stays in view.',
        clip: { video: video.translate, caption: 'Translating an article with the original beside it' },
        body: doc(p('Each language has its own state: draft, scheduled or on the website. A translation goes live only together with the main language, so nothing from an unfinished original reaches your visitors. Your developer turns this on where it makes sense, for articles for example.'),
          p('A field you have not translated yet shows the original text in grey. That is exactly what visitors would see until you translate it. Longer texts can sit beside the original, so you translate paragraph by paragraph.'),
          p('This is how translating with the original beside it looks:'),
          picture(shots.translating, 'Translating an article: the original text on the left, the translation being typed on the right'),
          p('In the list of articles, a small mark shows the state of each language. On a phone, tap the language name at the top to switch.'),
          p('How to translate and publish a language is in the ', a('Translations', '/en/docs/editors/translations'), ' chapter of the editors’ guide.')),
      },
      'pnpm-create-tinyzoo': {
        title: 'A new website with one command: pnpm create tinyzoo', slug: 'pnpm-create-tinyzoo',
        perex: 'The command asks about languages, parts of the website and demo content. A few minutes later you have a website with its admin area, ready to run.',
        body: doc(p('Choose the website’s languages (the first one is the default), the parts it needs (news, a contact form, redirects, search) and whether you want demo content. Whatever you leave out is not in the project at all.'),
          p('This is how the command looks when it runs:'),
          picture(shots.terminal, 'A terminal running pnpm create tinyzoo: questions about the folder, the languages, the parts of the website, demo content and installing dependencies, then the created project and the commands to start it'),
          p('Every question has an option too, so the command also runs without asking: pnpm create tinyzoo my-site --languages en,de --presets news,search --no-demo --yes.'),
          p('Each new project also has an AGENTS.md file. It is a short guide for the assistant you code with: where the content model is, how to change it and what not to touch.'),
          p('The ', a('Getting started', '/en/docs/developers/getting-started'), ' guide in the docs walks you through it step by step.')),
      },
      vyhledavani: {
        title: 'Search on your website and in the admin area', slug: 'search',
        perex: 'Visitors find your content by any word in it. In the admin area, press ⌘K to find any entry.',
        body: doc(p('Search looks through headings, text and the content of blocks. Accents and capital letters do not matter, and it copes with typos: “preveiw” finds “preview”.'),
          p('In the admin area, open search with the button in the sidebar or with ⌘K (Ctrl+K). It finds drafts and text in other languages too.')),
      },
      'seznamy-v-blocich': {
        title: 'Cards and questions on one page', slug: 'lists-in-blocks',
        perex: 'You can now build a page with cards or questions and answers. Drag them into the order you need.',
        body: doc(p('Build a page from ready-made sections, such as cards or questions and answers. Add your own text and drag the sections into order.'),
          p('We put this website together in the same way.')),
      },
      formulare: {
        title: 'Form messages in the admin area', slug: 'forms',
        perex: 'Find new messages from your website in one place. An email lets you know whenever one arrives.',
        body: doc(p('Messages from website forms are saved in the admin area. An email lets you know when a new message arrives. Download them as a spreadsheet for Excel to work with them further.'),
          p('The forms include spam protection.')),
      },
      'odkazy-vyberem-stranky': {
        title: 'Add a link by the page title', slug: 'links-by-page-title',
        perex: 'While writing, find the page you want to link to by its title. No need to copy its address.',
        body: doc(p('Select the words you want to turn into a link. Search for the page by its title and select it. You can stay with the text you are writing.')),
      },
      'opravy-z-testu': {
        title: 'We fixed the issues found while testing the admin area', slug: 'fixes-from-testing',
        perex: 'Before the pilot, we went through all the usual editing tasks in detail. We fixed every issue we found.',
        body: doc(p('Testing revealed two serious issues and around twenty smaller ones. We fixed them all. tinyzoo also has over 350 automated tests.'),
          p('Clients have not used the admin area in their everyday work yet. We want to learn from their experience in the pilot on our first client website.')),
      },
      'spolecne-psani': {
        title: 'Write in the same article together', slug: 'writing-together',
        perex: 'Write at the same time as a colleague. You can both see where the other person is typing.',
        body: doc(p('Several people can now edit an article at once. See where others are typing. Your changes will not overwrite each other.'),
          picture(img.desk, 'A desk with a laptop used to write an article'),
          p('You can add text together, or review and correct it with a colleague.')),
      },
      'nahled-vedle-editoru': {
        title: 'See a page preview as you edit', slug: 'preview-beside-editor',
        perex: 'A live preview sits beside your editing area. You can switch it to a phone view too.',
        body: doc(p('As you put a page together, you can see how it will look right beside it. Switch the preview to a phone view if you need to.'),
          p('You can also preview unfinished content that is not yet on your website.')),
      },
      planovani: {
        title: 'Choose when to publish', slug: 'scheduled-publishing',
        perex: 'Prepare a news post in advance. It will appear on your website at the time you choose.',
        body: doc(p('Choose a day and time when scheduling publication. You can prepare an article today and have it go live on Monday morning.'),
          p('If you need an earlier version of the text, you will find it in version history.')),
      },
      'pilot-na-klientskem-webu': {
        title: 'Preparing our first pilot', slug: 'first-client-pilot',
        perex: 'We are preparing a trial on our first client website. We want to see how people get on editing real content.',
        body: doc(p('During the pilot, real editors will try tinyzoo while looking after their website. Their observations will show us what still needs work.')),
      },
      'co-chystame-dal': {
        title: 'Feedback for the next changes', slug: 'what-comes-next',
        perex: 'We are making room for what we learn from the demo and the first pilot.',
        body: doc(p('We want to capture what helps people while editing and where they need clearer explanations. This text is still a draft.')),
      },
    },
    navigation: {
      main: [link('Roadmap', '/en/roadmap'), link('News', '/en/news'), link('For developers', '/en/developers'), link('Get in touch', '/en/feedback')],
      footer: [link('Home', '/en'), link('Roadmap', '/en/roadmap'), link('Try the admin area', '/en/demo'), link('News', '/en/news'), link('For developers', '/en/developers'), link('Get in touch', '/en/feedback'), link('Design system', '/en/design-system'), link('Edit this website', '/admin')],
    },
    settings: {
      tagline: 'Feel at home editing your website.',
      footerNote: 'Version 1.0 is out. Try the demo and tell us how you get on.',
      metaDescription: 'tinyzoo is a friendly admin area for your website. Write articles, build pages and preview your content. Try the demo and share your experience.',
    },
  }
}
