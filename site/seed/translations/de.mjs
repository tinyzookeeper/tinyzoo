export default (h) => {
  const { id, item, p, doc, link, picture, video, img, shots, a } = h
  const configCode = h.code.configCode
    .replace('// Pole pro editora, typovaný obsah pro web.', '// Felder für die Redaktion, typisierte Inhalte für die Website.')
    .replace("label: { cs: 'Aktuality', en: 'News' }", "label: { cs: 'Aktuality', en: 'News', de: 'Neuigkeiten' }")
    .replace('/aktuality/:slug', '/neuigkeiten/:slug')
  const pageCode = h.code.pageCode
    .replace('// news má typ News, odvozený z cms.config.ts', '// news hat den Typ News, abgeleitet aus cms.config.ts')

  return {
    pages: {
      home: {
        title: 'Startseite', slug: 'home',
        sections: [
          {
            id: id(), type: 'hero', eyebrow: null,
            heading: 'Damit Sie Ihre Website gerne pflegen.',
            text: 'Wir bauen Ihre Website gemeinsam mit Ihnen. Dazu bekommen Sie tinyzoo: einen Verwaltungsbereich in Ihrer Sprache, in dem Sie Beiträge schreiben, Seiten zusammenstellen und Inhalte veröffentlichen.\nWir möchten, dass Sie dort in Ruhe und mit Freude arbeiten können. Probieren Sie die Demo aus und erzählen Sie uns, wie Sie zurechtkommen.',
            primaryLabel: 'Verwaltung ausprobieren', primaryUrl: '/de/demo',
            secondaryLabel: 'Eindrücke mitteilen', secondaryUrl: '/de/feedback',
            video: video.link, image: null,
          },
          {
            id: id(), type: 'features', eyebrow: null,
            heading: 'Alles Wichtige ist griffbereit.',
            text: 'Schreiben Sie eine Neuigkeit, bearbeiten Sie eine Seite oder lesen Sie eine Nachricht von Ihrer Website. Die Verwaltung gibt es auf Deutsch, Englisch und Tschechisch, und sie funktioniert auch auf dem Smartphone.',
            items: [
              item({ title: 'Texte, Bilder und Links', text: 'Schreiben Sie mit Überschriften und Listen. Ergänzen Sie eine Bildbeschreibung und legen Sie fest, was beim Zuschneiden sichtbar bleiben soll. Links finden Sie über den Seitentitel.', animal: 'bunny' }),
              item({ title: 'Eine Seite nach Ihren Bedürfnissen', text: 'Wählen Sie fertige Seitenabschnitte: etwa Karten, Fragen und Antworten oder ein Video. Ändern Sie die Reihenfolge durch Ziehen. Daneben sehen Sie sofort die Vorschau, auch für das Smartphone.', animal: 'elephant' }),
              item({ title: 'Gemeinsam an einem Beitrag arbeiten', text: 'Schreiben Sie mit einer Kollegin oder einem Kollegen im selben Beitrag. Sie sehen, wo die andere Person gerade schreibt. Ihre Änderungen überschreiben sich nicht gegenseitig.', animal: 'octopus' }),
              item({ title: 'Noch ein Blick vor dem Veröffentlichen', text: 'Fehlt eine Pflichtangabe oder eine Bildbeschreibung? Die Verwaltung weist Sie darauf hin. Sie können die Angabe direkt ergänzen.', animal: 'bird' }),
              item({ title: 'Veröffentlichen, wenn Sie so weit sind', text: 'Veröffentlichen Sie einen Beitrag sofort oder wählen Sie Tag und Uhrzeit. Über den Versionsverlauf können Sie zu einer früheren Fassung zurückkehren.', animal: 'frog' }),
              item({ title: 'Nachrichten von der Website an einem Ort', text: 'Nachrichten aus Formularen finden Sie in der Verwaltung. Eine E-Mail informiert Sie über neue Eingänge. Sie können die Nachrichten auch als Tabelle für Excel herunterladen.', animal: 'fox' }),
            ],
          },
          {
            id: id(), type: 'showcase', eyebrow: null,
            heading: 'Vier kleine Aufgaben aus dem Alltag.',
            text: 'Kurze Videos zeigen die Arbeit direkt in der Verwaltung. Danach können Sie dieselben Aufgaben selbst ausprobieren.',
            items: [
              item({ title: 'Einen Link über den Seitentitel einfügen', text: 'Markieren Sie Wörter im Text und suchen Sie die Zielseite. Die Adresse müssen Sie nicht kopieren.', video: video.link }),
              item({ title: 'Eine Nachricht von der Website lesen', text: 'Jemand füllt ein Formular aus und die Nachricht erscheint in der Verwaltung. Eine E-Mail informiert Sie über den Eingang.', video: video.form }),
              item({ title: 'Einen Beitrag bearbeiten oder mit einer Kopie beginnen', text: 'Sehen Sie sich die Beitragsliste an, öffnen Sie einen Beitrag und bearbeiten Sie ihn. Einen neuen Beitrag können Sie auch als Kopie eines vorhandenen anlegen.', video: video.duplicate }),
              item({ title: 'Eine zweite Menüebene hinzufügen', text: 'Ordnen Sie eine Seite unter einem anderen Menüpunkt ein. Auf der Website finden Besucher sie dann im aufklappbaren Menü.', video: video.menu }),
            ],
          },
          {
            id: id(), type: 'steps', eyebrow: null,
            heading: 'Von der gemeinsamen Planung zum eigenen Beitrag.',
            items: [
              item({ title: 'Wir planen und bauen Ihre Website gemeinsam', text: 'Wir besprechen, was Ihre Website können soll und welche Inhalte Sie ändern werden. Darauf stimmen wir die Website ab.' }),
              item({ title: 'Sie bekommen Ihre eigene Verwaltung', text: 'In tinyzoo finden Sie Seiten, Beiträge und die Bildbibliothek. Hier kümmern Sie sich um die Inhalte Ihrer Website.' }),
              item({ title: 'Schreiben und die Vorschau im Blick behalten', text: 'Ergänzen Sie Texte und Bilder oder stellen Sie eine Seite aus fertigen Abschnitten zusammen. In der Vorschau sehen Sie sich die Seite vor dem Veröffentlichen an.' }),
              item({ title: 'Zum passenden Zeitpunkt veröffentlichen', text: 'Ergänzen Sie fehlende Angaben und veröffentlichen Sie den fertigen Inhalt. Oder wählen Sie Tag und Uhrzeit, zu denen er auf der Website erscheinen soll.' }),
            ],
          },
          {
            id: id(), type: 'cta', heading: 'Bearbeiten Sie einen eigenen Beitrag.',
            text: 'In der Demo können Sie in Ruhe ausprobieren. Wir setzen sie jede Nacht zurück. Ihre Eindrücke helfen uns bei der Vorbereitung des Pilotprojekts auf unserer ersten Kundenwebsite.',
            primaryLabel: 'Demo öffnen', primaryUrl: '/de/demo', secondaryLabel: 'Erfahrungen teilen', secondaryUrl: '/de/feedback', animal: 'fox',
          },
          {
            id: id(), type: 'faq', heading: 'Bevor Sie mit dem Bearbeiten beginnen',
            text: 'Ein paar Antworten auf Fragen, die Sie vielleicht haben.',
            items: [
              item({ question: 'Brauche ich zuerst eine Schulung?', answer: 'Sie können die Demo öffnen und gleich Ihren ersten Beitrag ausprobieren. Auf der Demoseite finden Sie ein paar konkrete Aufgaben. Im Pilotprojekt möchten wir auch herausfinden, wo Menschen eine Erklärung brauchen. Falls Sie nicht weiterkommen, schreiben Sie uns.' }),
              item({ question: 'Kann ich beim Ausprobieren etwas kaputtmachen?', answer: 'Die Demo ist zum Ausprobieren da. Wir setzen sie jede Nacht auf den Ausgangszustand zurück. Sie können also nichts dauerhaft kaputtmachen. Auch Ihre Änderungen bleiben dort nicht erhalten. Auf Ihrer eigenen Website können Sie unfertige Inhalte vor dem Veröffentlichen in der Vorschau ansehen.' }),
              item({ question: 'Was passiert, wenn wir zu zweit denselben Beitrag bearbeiten?', answer: 'Sie können gleichzeitig darin schreiben. Beide sehen, wo die andere Person gerade schreibt. Die Änderungen überschreiben sich nicht gegenseitig.' }),
              item({ question: 'Kann ich zu einer früheren Version zurückkehren?', answer: 'Ja. Im Versionsverlauf können Sie eine frühere Fassung Ihrer Inhalte wiederherstellen.' }),
              item({ question: 'Wie finde ich schnell einen älteren Artikel?', answer: 'Drücken Sie ⌘K (unter Windows Strg+K) oder klicken Sie auf Suchen und geben Sie ein beliebiges Wort aus dem Artikel ein. Die Suche findet auch Entwürfe und kommt mit Tippfehlern zurecht.' }),
              item({ question: 'Funktioniert die Verwaltung auf dem Smartphone?', answer: 'Ja, Sie können Inhalte auch auf dem Smartphone bearbeiten. Außerdem lässt sich die Seitenvorschau auf die Smartphone-Ansicht umstellen. So sehen Sie, wie die Seite für Besucher aussehen wird. Wir planen auch eine eigene mobile App.' }),
              item({ question: 'Ist tinyzoo fertig? Kann ich es schon ausprobieren?', answer: 'Die Demo ist für alle offen und wird jede Nacht zurückgesetzt. tinyzoo ist neu. Es hat über 1.600 automatisierte Tests. Vor dem Pilotprojekt haben wir außerdem alle üblichen Aufgaben bei der Inhaltspflege gründlich durchgespielt. Die gefundenen Fehler haben wir behoben. Kunden haben es bisher noch nicht im Arbeitsalltag genutzt. Das werden wir im Pilotprojekt erproben. Um die Weiterentwicklung und Fehlerbehebung kümmern wir uns selbst.' }),
              item({ question: 'Was ist, wenn ich mehr brauche?', answer: 'Sagen Sie uns, was Sie auf Ihrer Website machen möchten. Einen Katalog fertiger Erweiterungen haben wir nicht. Zusätzliche Möglichkeiten entwickeln wir für die jeweilige Website.' }),
            ],
          },
        ],
        metaDescription: 'tinyzoo ist eine Website-Verwaltung in Ihrer Sprache. Schreiben Sie Beiträge, stellen Sie Seiten zusammen und prüfen Sie die Vorschau. Probieren Sie die Demo aus.',
      },
      plany: {
        title: 'Roadmap', slug: 'roadmap',
        sections: [
          {
            id: id(), type: 'roadmap', eyebrow: null,
            heading: 'Was fertig ist und was kommt.',
            text: 'Ihre Rückmeldungen zur Demo und zur Arbeit an Ihrer Website helfen uns, die nächsten Schritte festzulegen.',
            note: 'Schreiben Sie uns, was Sie bei der Pflege Ihrer Website am meisten Zeit kostet.',
          },
          {
            id: id(), type: 'cta', heading: 'Was würde Ihnen helfen?',
            text: 'Probieren Sie die Demo von tinyzoo aus oder erzählen Sie uns, was Sie bei der Website-Pflege brauchen. Ihre Erfahrungen helfen uns bei den nächsten Schritten.',
            primaryLabel: 'Demo ausprobieren', primaryUrl: '/de/demo', secondaryLabel: 'Schreiben Sie uns', secondaryUrl: '/de/feedback', animal: 'fox',
          },
        ],
        metaDescription: 'Erfahren Sie, was tinyzoo schon kann und was Version 1.0 für Ihre Website bedeutet. Sehen Sie, was Sie ab Version 1.1 erwartet.',
      },
      demo: {
        title: 'Verwaltung ausprobieren', slug: 'demo',
        sections: [{
          id: id(), type: 'demo', heading: 'Probieren Sie die Website-Verwaltung aus.',
          text: 'Die Demo ist für alle offen. Melden Sie sich mit den Zugangsdaten auf dieser Seite an und legen Sie los. Wir setzen die Demo jede Nacht zurück. Sie können also nichts dauerhaft kaputtmachen. Ihre Arbeit bleibt hier allerdings auch nicht erhalten. Hier sind ein paar Aufgaben für den Anfang.',
          tips: [
            item({ text: 'Schreiben Sie eine kurze Neuigkeit mit einer Überschrift und einer Liste. Fügen Sie ein Bild mit Beschreibung hinzu und wählen Sie den Bereich, der beim Zuschneiden sichtbar bleiben soll.' }),
            item({ text: 'Markieren Sie ein paar Wörter und fügen Sie einen Link ein. Suchen Sie die Zielseite über ihren Titel.' }),
            item({ text: 'Fügen Sie einen fertigen Abschnitt zu einer Seite hinzu und verschieben Sie ihn durch Ziehen. Prüfen Sie die Vorschau auch in der Smartphone-Ansicht.' }),
            item({ text: 'Bereiten Sie einen Beitrag vor und planen Sie die Veröffentlichung für morgen früh.' }),
            item({ text: 'Öffnen Sie denselben Beitrag in zwei Fenstern. Schreiben Sie abwechselnd in beiden und beobachten Sie, wo die Änderungen erscheinen.' }),
            item({ text: 'Suchen Sie die Nachrichten aus einem Website-Formular und laden Sie sie als Tabelle für Excel herunter.' }),
          ],
        }],
        metaDescription: 'Probieren Sie die Verwaltung von tinyzoo aus. Schreiben Sie eine Neuigkeit, bearbeiten Sie eine Seite und prüfen Sie die Vorschau. Jede Nacht zurückgesetzt.',
      },
      'zpetna-vazba': {
        title: 'Feedback', slug: 'feedback',
        sections: [{
          id: id(), type: 'feedback', heading: 'Wie sind Sie mit tinyzoo zurechtgekommen?',
          text: 'Schreiben Sie uns, was leichtging, wo Sie nicht weiterkamen oder was Ihnen gefehlt hat. Auch eine kleine Beobachtung bei einer einzelnen Aufgabe hilft. Ihre Erfahrungen helfen uns, das Pilotprojekt auf unserer ersten Kundenwebsite vorzubereiten.',
        }],
        metaDescription: 'Haben Sie tinyzoo ausprobiert? Erzählen Sie uns, was beim Bearbeiten gut lief und wo Sie nicht weiterkamen. Ihre Eindrücke helfen bei der Vorbereitung des Pilotprojekts.',
      },
      'pro-vyvojare': {
        title: 'Für Entwickler', slug: 'entwickler',
        sections: [
          {
            id: id(), type: 'hero', eyebrow: null,
            heading: 'Inhalte direkt in Nuxt verwalten.',
            text: 'Wir bauen Kundenwebsites mit Nuxt. Zu einer Website gehört auch ein Ort, an dem Kunden ihre Inhalte pflegen. Deshalb entwickeln wir tinyzoo: ein CMS mit einem Modell in TypeScript und einer Verwaltung auf Deutsch, Englisch oder Tschechisch.\nWebsite und Inhaltsverwaltung laufen in einer Anwendung. Ein Projekt, ein Deployment.',
            primaryLabel: 'Verwaltung ausprobieren', primaryUrl: '/de/demo',
            secondaryLabel: 'Was als Nächstes kommt', secondaryUrl: '/de/roadmap',
            video: video.duplicate, image: null,
          },
          {
            id: id(), type: 'code', eyebrow: null,
            heading: 'Beginnen Sie mit den Inhalten, die Ihre Website braucht.',
            text: 'In cms.config.ts beschreiben Sie Beiträge, Seitenblöcke und Formulare. Aus dem Modell entsteht die Verwaltung. Über eine generierte Client-Datei reichen die Typen bis in die Vue-Templates. tinyzoo ist ein Nuxt-Layer und -Modul, das direkt in Ihrer Anwendung läuft.',
            files: [item({ name: 'cms.config.ts', code: configCode }), item({ name: 'pages/neuigkeiten/[slug].vue', code: pageCode })],
            chips: 'defineEntity(), defineBlock(), definePages(), defineForm(), f.list()',
          },
          {
            id: id(), type: 'steps', eyebrow: null,
            heading: 'Vom ersten Befehl zur Inhaltspflege.',
            items: [
              item({ title: 'Projekt anlegen', text: 'Der Befehl pnpm create tinyzoo fragt nach Sprachen, Bausteinen und Beispielinhalten und legt die Grundlage für das Projekt an. Darauf bauen Sie Ihre Website in Nuxt auf.', command: 'pnpm create tinyzoo' }),
              item({ title: 'Inhalte beschreiben', text: 'Legen Sie in cms.config.ts fest, welche Inhalte Ihr Kunde bearbeiten wird. Aus dem Modell wird die Verwaltung generiert.', command: 'pnpm db:generate' }),
              item({ title: 'Anwendung bereitstellen', text: 'tinyzoo nutzt Node und Postgres. Wir stellen unsere Websites über Pushbase bereit. Website und Verwaltung werden gemeinsam bereitgestellt.', command: 'pnpm build' }),
              item({ title: 'Die Website gemeinsam mit dem Kunden durchgehen', text: 'Probieren Sie gemeinsam die Inhaltspflege, die Live-Vorschau und die Veröffentlichungsplanung aus. Dabei sehen Sie, wie der Kunde mit den vorbereiteten Inhalten zurechtkommt.' }),
            ],
          },
          {
            id: id(), type: 'faq', heading: 'Fragen von Entwicklern',
            items: [
              item({ question: 'Was gehört schon zu tinyzoo?', answer: 'Seiten aus Blöcken, Listen innerhalb von Blöcken und Formulare. Dazu Menüs mit Unterpunkten, Weiterleitungen, SEO-Felder und Übersetzungen. Die Medienbibliothek erzeugt Bilder bei Bedarf in den benötigten Größen. Beim Bearbeiten stehen eine Live-Vorschau, gemeinsames Schreiben in Echtzeit, geplante Veröffentlichungen und ein Versionsverlauf zur Verfügung. Besucher und Redakteure können die Inhalte durchsuchen, und die Suche kommt auch mit Tippfehlern zurecht.' }),
              item({ question: 'Was ist, wenn wir mehr brauchen?', answer: 'Zusätzliche Möglichkeiten schreiben wir als eigene Module im Code. Erzählen Sie uns, was Ihre Website braucht. Gemeinsam schauen wir, wie sie sich erweitern lässt.' }),
              item({ question: 'Wie greifen wir auf die Inhalte zu?', answer: 'Die Inhalte liegen in gewöhnlichen Postgres-Tabellen. Außerdem gibt es eine Inhalts-API, die in OpenAPI beschrieben ist. In Vue-Templates arbeiten Sie mit den Typen aus der generierten Client-Datei.' }),
              item({ question: 'Wer kümmert sich um die Wartung?', answer: 'Entwicklung und Fehlerbehebung übernehmen wir selbst. Über alle Websites hinweg aktualisieren wir ein Paket. tinyzoo ist noch jung. Über 1.600 automatisierte Tests und eine gründliche Prüfung aller üblichen Aufgaben bei der Inhaltspflege helfen uns, das Verhalten zu überprüfen. Weitere Erfahrungen sammeln wir nach und nach bei der Nutzung.' }),
            ],
          },
          {
            id: id(), type: 'cta', heading: 'Sehen Sie die Website aus Sicht der Redaktion.',
            text: 'Bearbeiten Sie einen Beitrag und sehen Sie sich die Vorschau an. Schreiben Sie uns danach, wie Sie zurechtgekommen sind und was Sie für Ihre eigene Website brauchen würden.',
            primaryLabel: 'Verwaltung ausprobieren', primaryUrl: '/de/demo', secondaryLabel: 'Eindrücke mitteilen', secondaryUrl: '/de/feedback', animal: 'frog',
          },
        ],
        metaDescription: 'tinyzoo für Nuxt-Websites: Inhaltsmodell in TypeScript, Verwaltung auf Deutsch, Englisch oder Tschechisch und Typen bis in Vue-Templates. Lernen Sie das Inhaltsmodell und die API kennen.',
      },
    },
    news: {
      'role-na-miru': {
        title: 'Eigene Rollen und Felder, die nur bestimmte Personen ändern dürfen', slug: 'eigene-rollen',
        perex: 'Neben Administrator, Editor und Autor kann Ihre Website eigene Rollen haben, etwa für Übersetzungen. Für jedes Feld legen Sie fest, wer es ändern darf.',
        clip: { video: video.roles, caption: 'Was jede Rolle darf, und die Einladung mit den Rollenbeschreibungen' },
        body: doc(p('Ihr Entwickler richtet die Rollen danach ein, wer in Ihrem Team was macht. Wer übersetzt, bearbeitet zum Beispiel nur Artikel und veröffentlicht nichts. Wer sich um die Autoren kümmert, pflegt ihre Profile und hat keinen Zugriff auf die Medienbibliothek.'),
          p('Ein Feld, das nur bestimmte Personen ändern dürfen, hat einen grauen Hintergrund und ein Schloss. Darunter steht, wer es ändern kann. So wissen Sie, an wen Sie sich wenden.'),
          p('Die Übersicht finden Sie unter Team:'),
          picture(shots.rolesOverview, 'Was darf welche Rolle? unter Team: eine Tabelle der Rollen mit dem, was jede bearbeitet, nur liest, ob sie veröffentlicht und auf welche Dateien sie zugreifen kann'),
          p('Und so sieht die Einladung aus, mit einem Satz zu jeder Rolle:'),
          picture(shots.invite, 'Eine Person einladen: die Liste der Rollen, bei jeder ein Satz dazu, was sie darf'),
          p('Unter Team finden Sie die Übersicht Was darf welche Rolle?. Beim Einladen und beim Ändern einer Rolle steht bei jeder Rolle ein Satz dazu, was sie darf.'),
          p('Was jede Rolle darf und was bei einem gesperrten Feld zu tun ist, steht im Kapitel ', a('Rollen und Berechtigungen', '/de/dokumentation/redaktion/rollen-und-berechtigungen'), ' des Handbuchs für die Redaktion.')),
      },
      'jazyky-zvlast': {
        title: 'Jede Sprache wird einzeln veröffentlicht, mit dem Original zur Hand', slug: 'sprachen-einzeln',
        perex: 'Die englische Fassung eines Artikels schreiben Sie in Ruhe fertig und veröffentlichen sie, wenn sie bereit ist. Beim Übersetzen haben Sie den Originaltext immer im Blick.',
        clip: { video: video.translate, caption: 'Einen Artikel übersetzen, das Original daneben' },
        body: doc(p('Jede Sprache hat ihren eigenen Status: Entwurf, geplant oder auf der Website. Eine Übersetzung geht nur zusammen mit der Hauptsprache online, so erreicht nichts aus einem unfertigen Original Ihre Besucher. Ihr Entwickler schaltet das dort ein, wo es sinnvoll ist, zum Beispiel bei Artikeln.'),
          p('Ein noch nicht übersetztes Feld zeigt den Originaltext in Grau. Genau das sähen Besucher, bis Sie es übersetzen. Längere Texte stellen Sie neben das Original und übersetzen Absatz für Absatz.'),
          p('So sieht das Übersetzen mit dem Original daneben aus:'),
          picture(shots.translating, 'Einen Artikel übersetzen: links der Originaltext, rechts die Übersetzung, die gerade geschrieben wird'),
          p('In der Artikelliste zeigt ein kleines Zeichen den Status jeder Sprache. Auf dem Handy tippen Sie oben auf den Namen der Sprache, um sie zu wechseln.'),
          p('Wie Sie übersetzen und eine Sprache veröffentlichen, steht im Kapitel ', a('Übersetzungen', '/de/dokumentation/redaktion/uebersetzungen'), ' des Handbuchs für die Redaktion.')),
      },
      'pnpm-create-tinyzoo': {
        title: 'Eine neue Website mit einem Befehl: pnpm create tinyzoo', slug: 'pnpm-create-tinyzoo',
        perex: 'Der Befehl fragt nach Sprachen, Teilen der Website und Beispielinhalten. Nach wenigen Minuten haben Sie eine Website mit Verwaltung, die Sie gleich starten können.',
        body: doc(p('Sie wählen die Sprachen der Website (die erste ist die Standardsprache), die Teile, die sie braucht (Neuigkeiten, Kontaktformular, Weiterleitungen, Suche), und ob Sie Beispielinhalte möchten. Was Sie weglassen, ist im Projekt gar nicht erst enthalten.'),
          p('So sieht der Befehl aus, wenn er läuft:'),
          picture(shots.terminal, 'Ein Terminal mit pnpm create tinyzoo: Fragen nach dem Ordner, den Sprachen, den Teilen der Website, Beispielinhalten und der Installation, danach das erstellte Projekt und die Befehle zum Starten'),
          p('Jede Frage hat auch eine Option, so läuft der Befehl auch ohne Rückfragen: pnpm create tinyzoo meine-website --languages de,en --presets news,search --no-demo --yes.'),
          p('Jedes neue Projekt hat außerdem eine Datei AGENTS.md. Sie ist eine kurze Anleitung für den Assistenten, mit dem Sie programmieren: wo das Inhaltsmodell liegt, wie man es ändert und was man nicht anfassen sollte.'),
          p('Schritt für Schritt erklärt es die Anleitung ', a('Getting started', '/en/docs/developers/getting-started'), ' in der Dokumentation (auf Englisch).')),
      },
      vyhledavani: {
        title: 'Suche auf der Website und in der Verwaltung', slug: 'suche',
        perex: 'Besucher finden Ihre Inhalte über jedes Wort darin. In der Verwaltung finden Sie jeden Eintrag mit ⌘K.',
        body: doc(p('Die Suche durchsucht Überschriften, Texte und den Inhalt von Blöcken. Akzente sowie Groß- und Kleinschreibung spielen keine Rolle, und Tippfehler verzeiht sie auch: „Vorshau“ findet „Vorschau“.'),
          p('In der Verwaltung öffnen Sie die Suche über die Schaltfläche in der Seitenleiste oder mit ⌘K (Strg+K). Sie findet auch Entwürfe und Texte in anderen Sprachen.')),
      },
      'seznamy-v-blocich': {
        title: 'Karten und Fragen auf einer Seite', slug: 'listen-in-bloecken',
        perex: 'Stellen Sie eine Seite jetzt mit Karten oder Fragen und Antworten zusammen. Die Reihenfolge ändern Sie durch Ziehen.',
        body: doc(p('Sie können eine Seite aus fertigen Abschnitten zusammenstellen, etwa Karten oder Fragen und Antworten. Ergänzen Sie eigene Texte und bringen Sie die Abschnitte durch Ziehen in die gewünschte Reihenfolge.'),
          p('Auch diese Website haben wir auf dieselbe Weise zusammengestellt.')),
      },
      formulare: {
        title: 'Formularnachrichten in der Verwaltung', slug: 'formulare',
        perex: 'Neue Nachrichten von Ihrer Website finden Sie an einem Ort. Über jede informiert Sie eine E-Mail.',
        body: doc(p('Nachrichten aus Website-Formularen werden in der Verwaltung gespeichert. Eine E-Mail informiert Sie über neue Eingänge. Für die weitere Arbeit können Sie die Nachrichten als Tabelle für Excel herunterladen.'),
          p('Die Formulare enthalten einen Spamschutz.')),
      },
      'odkazy-vyberem-stranky': {
        title: 'Links über den Seitentitel einfügen', slug: 'links-nach-seitentitel',
        perex: 'Suchen Sie beim Schreiben die Zielseite über ihren Titel. Die Adresse müssen Sie nicht mehr kopieren.',
        body: doc(p('Markieren Sie die Wörter, die zu einem Link werden sollen. Suchen Sie die Seite über ihren Titel und wählen Sie sie aus. Sie können bei Ihrem angefangenen Text bleiben.')),
      },
      'opravy-z-testu': {
        title: 'Fehler aus dem Verwaltungstest behoben', slug: 'fehlerbehebungen-aus-tests',
        perex: 'Vor dem Pilotprojekt haben wir alle üblichen Aufgaben bei der Inhaltspflege gründlich durchgespielt. Alle gefundenen Fehler sind behoben.',
        body: doc(p('Beim Test haben wir zwei schwerwiegende und etwa zwanzig kleinere Fehler gefunden. Wir haben alle behoben. tinyzoo hat außerdem über 350 automatisierte Tests.'),
          p('Kunden haben die Verwaltung bisher noch nicht im Arbeitsalltag genutzt. Ihre Erfahrungen möchten wir im Pilotprojekt auf unserer ersten Kundenwebsite sammeln.')),
      },
      'spolecne-psani': {
        title: 'Gemeinsam im selben Beitrag schreiben', slug: 'gemeinsam-schreiben',
        perex: 'Schreiben Sie gleichzeitig mit einer Kollegin oder einem Kollegen. Beide sehen, wo die andere Person gerade schreibt.',
        body: doc(p('Mehrere Menschen können jetzt gleichzeitig einen Beitrag bearbeiten. Sie sehen, wo die anderen schreiben. Ihre Änderungen überschreiben sich nicht gegenseitig.'),
          picture(img.desk, 'Schreibtisch mit einem Laptop beim Schreiben eines Beitrags'),
          p('So können Sie gemeinsam Text ergänzen oder ihn zusammen durchgehen und korrigieren.')),
      },
      'nahled-vedle-editoru': {
        title: 'Die Seitenvorschau beim Bearbeiten im Blick', slug: 'vorschau-neben-dem-editor',
        perex: 'Neben dem Bearbeitungsbereich sehen Sie eine Live-Vorschau. Sie lässt sich auch auf die Smartphone-Ansicht umstellen.',
        body: doc(p('Wenn Sie eine Seite zusammenstellen, sehen Sie direkt daneben, wie sie aussehen wird. Die Vorschau können Sie auf die Smartphone-Ansicht umstellen.'),
          p('Auch angefangene Inhalte, die noch nicht auf der Website stehen, können Sie ansehen.')),
      },
      planovani: {
        title: 'Tag und Uhrzeit der Veröffentlichung wählen', slug: 'veroeffentlichung-planen',
        perex: 'Bereiten Sie eine Neuigkeit im Voraus vor. Sie erscheint zum gewählten Zeitpunkt auf Ihrer Website.',
        body: doc(p('Wählen Sie bei der Veröffentlichungsplanung Tag und Uhrzeit. Sie können einen Beitrag zum Beispiel heute vorbereiten und am Montagmorgen erscheinen lassen.'),
          p('Wenn Sie zu einer früheren Textfassung zurückkehren möchten, finden Sie sie im Versionsverlauf.')),
      },
      'pilot-na-klientskem-webu': {
        title: 'Wir bereiten das erste Pilotprojekt vor', slug: 'erster-pilot-auf-kundenwebsite',
        perex: 'Wir bereiten einen Test auf unserer ersten Kundenwebsite vor. Uns interessiert, wie Menschen mit echten Inhalten zurechtkommen.',
        body: doc(p('Im Pilotprojekt werden Menschen, die ihre Website redaktionell pflegen, tinyzoo im Alltag ausprobieren. Ihre Eindrücke zeigen uns, wo noch etwas angepasst werden muss.')),
      },
      'co-chystame-dal': {
        title: 'Eindrücke für die nächsten Verbesserungen', slug: 'wie-es-weitergeht',
        perex: 'Wir schaffen einen Platz für die Erfahrungen aus der Demo und dem ersten Pilotprojekt.',
        body: doc(p('Wir möchten festhalten, was Menschen beim Bearbeiten hilft und wo sie eine bessere Erklärung brauchen. Dieser Text ist noch ein Entwurf.')),
      },
    },
    navigation: {
      main: [link('Roadmap', '/de/roadmap'), link('Neuigkeiten', '/de/neuigkeiten'), link('Für Entwickler', '/de/entwickler'), link('Schreiben Sie uns', '/de/feedback')],
      footer: [link('Startseite', '/de'), link('Roadmap', '/de/roadmap'), link('Verwaltung ausprobieren', '/de/demo'), link('Neuigkeiten', '/de/neuigkeiten'), link('Für Entwickler', '/de/entwickler'), link('Schreiben Sie uns', '/de/feedback'), link('Designsystem', '/de/designsystem'), link('Diese Website bearbeiten', '/admin')],
    },
    settings: {
      tagline: 'Damit Sie Ihre Website gerne pflegen.',
      footerNote: 'Wir bereiten ein Pilotprojekt auf unserer ersten Kundenwebsite vor. Probieren Sie die Demo aus und erzählen Sie uns, wie Sie zurechtkommen.',
      metaDescription: 'tinyzoo ist eine Website-Verwaltung in Ihrer Sprache. Schreiben Sie Beiträge, stellen Sie Seiten zusammen und prüfen Sie die Vorschau. Teilen Sie Ihre Erfahrungen mit uns.',
    },
  }
}
