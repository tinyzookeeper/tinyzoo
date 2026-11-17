# Menüs und Links

Wie Sie die Menüs der Website bearbeiten, ein Untermenü anlegen, so verlinken, dass Links nicht kaputtgehen, und Besucher von einer alten Adresse auf eine neue schicken.

> Die Namen können bei Ihrer Website anders sein. Die Grundausstattung hat die Bereiche **Navigation** und **Weiterleitungen**.

## Die Menüs der Website

Die Menüs finden Sie im Bereich **Navigation**. Meist gibt es zwei:

- **Hauptmenü**: die Leiste oben auf der Website,
- **Menü im Seitenfuß**: die Links ganz unten.

Jedes Menü ist eine Liste von Links. Einzeln veröffentlichen müssen Sie nichts: Ein Menü geht **gleich beim Speichern** auf die Website (**Änderungen erscheinen auf der Website, sobald Sie speichern.**). Prüfen Sie deshalb nach jeder Änderung die Website.

### Einen Link hinzufügen

1. Öffnen Sie **Navigation** und suchen Sie das Menü, das Sie ändern möchten.
2. Klicken Sie auf **Eintrag hinzufügen**.
3. Füllen Sie aus:
   - **Linktext**: die Wörter, die Besucher sehen (etwa „Kontakt“).
   - **Adresse**: wohin der Link führt (siehe unten).
   - **In neuem Tab öffnen**: Setzen Sie das Häkchen bei Links auf fremde Websites, damit Besucher Ihre Website nicht verlassen.
   - **Unter dem vorherigen Link**: siehe Untermenü weiter unten.
4. Klicken Sie auf **Speichern**.

Hat die Website mehrere Sprachen, hat jede Sprache ihr eigenes Menü: Wechseln Sie die Sprache (siehe [Übersetzungen](uebersetzungen.md)) und bearbeiten Sie es getrennt. Fehlt das Menü in einer Sprache, wird das der Standardsprache verwendet.

Die Reihenfolge ändern Sie, indem Sie einen Link an eine andere Stelle ziehen. Einen Link, den Sie nicht mehr brauchen, entfernen Sie mit **Entfernen**. Solange Sie nicht auf **Speichern** klicken, ändert sich nichts.

<!-- screenshot: Bearbeitung des Hauptmenüs: eine Liste von Links mit den Feldern Linktext und Adresse und den Schaltern -->

### Ein Untermenü

Sollen beim Darüberfahren über **Über uns** die Links **Team** und **Geschichte** aufklappen? Setzen Sie den Link, der ins Untermenü gehört, in der Liste **direkt unter** den Hauptlink und setzen Sie bei ihm das Häkchen **Unter dem vorherigen Link**. Die Verwaltung erklärt dazu: *Erscheint im Untermenü des vorherigen Links.* Unter einen Link können Sie mehrere solche Links setzen.

> **Tipp:** Wenn Sie einen Link wieder in die Hauptleiste holen möchten, entfernen Sie das Häkchen. Prüfen Sie, ob die Reihenfolge so aussieht, wie Sie erwarten. Links im Untermenü stehen immer unter dem Link, zu dem sie gehören.

Wie sich das Untermenü auf der Website verhält und wie es aussieht, bestimmt das Design der Website. In der Verwaltung legen Sie nur fest, was wohin gehört.

## Wohin ein Link führt

Das Feld **Adresse** (und ein Link im Text) kann zweierlei. Tippen Sie ins Feld:

- **Den Titel einer Seite**: Fangen Sie an zu tippen, und die Verwaltung schlägt Seiten Ihrer Website vor (**Auf dieser Website**). Wählen Sie die richtige aus.
- **Eine vollständige Adresse**: zum Beispiel `https://www.firma.de`, `mailto:info@firma.de` für eine E-Mail oder `tel:+4930123456789` für ein Telefon. Die Verwaltung bietet das als **Link zu …** an.

Bleibt das Feld leer oder geben Sie etwas Ungültiges ein, erscheint **Geben Sie /seite, https://…, mailto: oder tel: ein**.

> **Tipp:** Verlinken Sie Seiten Ihrer eigenen Website **durch Auswahl aus den Vorschlägen**, nicht durch Eintippen der Adresse. Warum, erklärt der nächste Abschnitt.

### Links, die sich selbst reparieren

Wählen Sie eine Seite aus den Vorschlägen, merkt sich die Verwaltung **die Seite**, nicht ihre Adresse. Unter dem Link sehen Sie **Der Link folgt der Seite, wenn sich ihre Adresse ändert**. Benennen Sie die Seite später um, verschieben Sie sie unter eine andere oder übersetzen Sie sie, **funktioniert der Link weiter**. Menüs, Schaltflächen auf Seiten und Links im Text passen sich von selbst an.

Unter dem Link sehen Sie den Titel der Seite und ihre Adresse in der Sprache, die Sie gerade bearbeiten. Dazu können Warnungen kommen:

- **Noch nicht veröffentlicht: Besucher sehen hier erst einen Link, wenn die Seite veröffentlicht ist.** Der Link erscheint auf der Website erst, wenn Sie die Seite veröffentlichen, auf die er führt.
- **Diese Seite gibt es nicht mehr, daher sehen Besucher hier keinen Link. Wählen Sie eine andere Seite.** Die Zielseite wurde gelöscht.

Die Verwaltung lässt also nicht zu, dass Sie eine Seite löschen, auf die noch etwas verlinkt (siehe **Wird noch verwendet** im Kapitel [Seiten und Blöcke](seiten-und-bloecke.md)). Sie sagt Ihnen, wo der Link ist, und Sie passen ihn dort zuerst an.

Einen Link ändern Sie mit **Link ändern**, entfernen ihn mit **Link entfernen**. Eine Seite wählen Sie mit **Seite auswählen** aus.

> **Achtung:** Ältere Links, die jemand irgendwann von Hand als Adresse eingetippt hat, reparieren sich nicht von selbst. Der Entwickler kann sie ein für alle Mal umstellen. Sind nach dem Verschieben von Seiten einige kaputtgegangen, sagen Sie es ihm.

## Weiterleitungen

Was, wenn jemand eine Seite als Lesezeichen gespeichert hat oder sie über eine Suchmaschine findet, Sie sie aber umbenannt haben? Eine Weiterleitung schickt Besucher automatisch von der alten Adresse auf die neue.

Sie finden sie im Bereich **Weiterleitungen**. Legen Sie eine neue an und füllen Sie aus:

- **Von**: die alte Adresse auf Ihrer Website, zum Beispiel `/alte-seite`. Sie beginnt mit einem Schrägstrich.
- **Nach**: wohin Besucher geschickt werden sollen, entweder eine Seite dieser Website (**Seite auswählen**) oder eine andere Website (`https://…`).
- **Dauerhaft**: Lassen Sie das Häkchen gesetzt, wenn die Seite für immer umgezogen ist. Suchmaschinen merken sich dann die neue Adresse. Entfernen Sie es nur, wenn es um etwas Vorübergehendes geht.

Eine Weiterleitung gilt auf der Website **gleich nach dem Speichern**. Die Verwaltung lässt keinen Kreis zu (Adresse A auf B und B zurück auf A): Sie zeigt **Eine andere Weiterleitung führt bereits hierher zurück. Das würde eine Schleife erzeugen. Wählen Sie eine andere Adresse.**

> **Achtung:** Weiterleitungen dürfen nur Administratoren und Redakteure anlegen, weil sie sofort auf der Website wirken.

Verschieben Sie eine Seite im [Seitenbaum](seiten-und-bloecke.md), legt die Verwaltung die Weiterleitungen von den alten Adressen selbst an, wenn dieser Bereich auf der Website eingeschaltet ist.

## Siehe auch

- [Seiten und Blöcke](seiten-und-bloecke.md): Seitenbaum und Löschen
- [Übersetzungen](uebersetzungen.md): Menüs in einer anderen Sprache
- [Wenn etwas nicht klappt](wenn-etwas-nicht-klappt.md): „Ein Link im Menü wird nicht angezeigt“
