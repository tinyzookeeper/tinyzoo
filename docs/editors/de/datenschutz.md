# Datenschutz

Was Sie tun, wenn jemand fragt, welche Daten Sie über ihn gespeichert haben, oder möchte, dass Sie sie löschen. Den Bereich **Datenschutz** sehen nur Administratoren.

Menschen haben das Recht zu erfahren, was eine Firma über sie speichert, und das in lesbarer Form zu bekommen oder es löschen zu lassen. Die Verwaltung hat dafür ein Werkzeug, das alles findet, was zu einer E-Mail-Adresse gespeichert ist. Das ist keine Rechtsberatung. Fragen Sie auch Ihren Datenschutzbeauftragten oder einen Anwalt, wie und bis wann Sie auf solche Anfragen antworten müssen.

## Wo Sie es finden

Klicken Sie im Menü links im Bereich **Einstellungen** auf **Datenschutz**. Sehen Sie den Eintrag nicht, sind Sie kein Administrator. Bitten Sie eine Kollegin oder einen Kollegen, die oder der Administrator ist. Versuchen Sie es auf anderem Weg, erscheint **Nur Administratoren können diese Seite nutzen.**

## Was hier gefunden wird

Die Verwaltung sucht nach der E-Mail-Adresse. Sie durchsucht drei Stellen:

- **Formularnachrichten**: Nachrichten, die von dieser Adresse über die Website gekommen sind (z. B. über das Kontaktformular).
- **Konto in dieser Verwaltung**: wenn die Person bei Ihnen ein Konto hat (also eine Kollegin oder ein Kollege ist).
- **Aktivitätsprotokoll**: Einträge, die dieses Konto erzeugt hat, Einträge über das Konto (Einladung, Rollenänderung, Änderung der Anmelde-E-Mail von dieser Adresse oder auf sie) und fehlgeschlagene Anmeldungen mit dieser Adresse.

Beim Konto kann außerdem ein Satz erscheinen, dass eine **Änderung der Anmelde-E-Mail** diese Adresse nennt: Entweder hat jemand den Wechsel auf diese Adresse angefordert und noch nicht bestätigt, oder es geht um einen Link zum Rückgängigmachen, der an diese Adresse ging (siehe [E-Mail-Adresse ändern](anmeldung-und-konto.md#e-mail-adresse-ändern)). Im Export steht das unter `emailChanges`. Nennt ein Eintrag über eine E-Mail-Änderung auch eine zweite Adresse, die nicht dieser Person gehört, steht im Export an ihrer Stelle nur „(another person’s address)“.

Andere Texte, die jemand in die Inhalte der Website geschrieben hat, werden bei der Suche nicht durchsucht.

## Was zu einer Adresse gespeichert ist

1. Öffnen Sie **Datenschutz**.
2. Geben Sie die vollständige **E-Mail-Adresse** ein (`name@example.com`). Ist sie unvollständig, erscheint **Geben Sie eine vollständige E-Mail-Adresse ein.**
3. Klicken Sie auf **Suchen**.

Es erscheint **Gespeichert zu …** und darunter drei Bereiche mit dem, was gefunden wurde. Bei einem Bereich ohne Treffer sehen Sie Sätze wie **Von dieser Adresse wurde keine Nachricht gesendet.**, **Kein Konto mit dieser Adresse.** oder **Keine Einträge zu dieser Adresse.** Ist nirgends etwas gespeichert, sehen Sie **Zu dieser Adresse ist nichts gespeichert.**

<!-- screenshot: die Seite Datenschutz mit gefundenen Nachrichten, Konto und Einträgen im Aktivitätsprotokoll und den Schaltflächen Als JSON exportieren und Daten dieser Person löschen -->

## Daten an die Person herausgeben

Wenn jemand eine Kopie seiner Daten verlangt:

1. Suchen Sie nach seiner Adresse (siehe oben).
2. Klicken Sie auf **Als JSON exportieren**. Es wird eine Datei mit dem heruntergeladen, was Sie über die Person gespeichert haben. Passwörter sind nicht enthalten. Bestätigt wird das mit **Datei heruntergeladen**.
3. Geben Sie die Datei auf sicherem Weg an die Person weiter (zum Beispiel über eine verschlüsselte Nachricht, nicht als gewöhnlichen Anhang), und prüfen Sie, dass die Anfrage wirklich von ihr stammt.

## Die Daten einer Person löschen

1. Suchen Sie nach der E-Mail-Adresse.
2. Klicken Sie auf **Daten dieser Person löschen**.
3. Die Verwaltung fragt **Alles zu … löschen?** und zählt auf, was genau passiert, nur für das, was es gibt:
   - **Formularnachrichten werden endgültig gelöscht, samt gespeicherter Versionen**,
   - das **Konto** mit dieser Adresse wird gesperrt und anonymisiert: Name und E-Mail-Adresse werden entfernt, was die Person in der Verwaltung getan hat, bleibt aber unter der Bezeichnung „gelöschtes Konto“ erhalten,
   - im **Aktivitätsprotokoll** werden Name, E-Mail-Adresse und IP-Adresse entfernt,
   - eine wartende **Änderung der Anmelde-E-Mail** auf diese Adresse oder ein Link zum Rückgängigmachen an sie wird abgebrochen.
4. Lesen Sie das durch und bestätigen Sie. Die Verwaltung betont immer: **Das lässt sich nicht rückgängig machen.**
5. Ist alles erledigt, sehen Sie **Gelöscht. Zu … ist nichts mehr gespeichert.**

> **Achtung:** Das Löschen lässt sich nicht rückgängig machen, weder in der Verwaltung noch über den Verlauf. Prüfen Sie die Adresse vor dem Bestätigen zweimal. Wir empfehlen, zuerst **Als JSON exportieren** zu verwenden und die Datei an einem sicheren Ort aufzubewahren, bis Sie sicher sind, dass es wirklich um die richtige Person geht.

> **Achtung:** Sie können **Ihr eigenes Konto** nicht löschen, und auch nicht den letzten aktiven Administrator. Möchten Sie selbst die Verwaltung nicht mehr nutzen, bitten Sie einen anderen Administrator darum.

## Was das Löschen nicht ändert

Die Verwaltung sagt das offen: **Hochgeladene Dateien und Texte, die jemand in Inhalten geschrieben hat, sind Inhalt der Website und bleiben. Backups werden nicht verändert.** Das bedeutet praktisch:

- Ein Foto, das die Person hochgeladen hat, und Texte, die sie in Seiten oder Neuigkeiten geschrieben hat, bleiben erhalten. Müssen auch sie gelöscht werden, tun Sie das von Hand (siehe [Bilder und Dateien](bilder-und-dateien.md) und [Seiten und Blöcke](seiten-und-bloecke.md)).
- **Backups** Ihrer Firma und des Entwicklers enthalten die Daten, die zum Zeitpunkt des Backups vorhanden waren. Diese verschwinden nach und nach, wenn die Backups ersetzt werden. In Ihrer Antwort an die Person können Sie das erwähnen (und fragen Sie den Entwickler, wie lange die Backups aufbewahrt werden).
- Eine E-Mail mit einer Kopie der Nachricht, die in Ihrem Postfach angekommen ist, wird dadurch nicht gelöscht. Löschen Sie sie selbst.

## Nachrichten löschen sich von selbst

Neben dem Löschen von Hand werden Formularnachrichten auf manchen Websites nach einer gewissen Zeit von selbst gelöscht. Siehe [Formularnachrichten](formularnachrichten.md). Das Protokoll der Vorgänge in der Verwaltung (wer sich wann angemeldet und was getan hat) wird nach einem Jahr gelöscht, wenn der Entwickler nichts anderes eingestellt hat.

## Siehe auch

- [Formularnachrichten](formularnachrichten.md)
- [Anmeldung und Ihr Konto](anmeldung-und-konto.md): Rollen und Einladungen
- [Wenn etwas nicht klappt](wenn-etwas-nicht-klappt.md)
