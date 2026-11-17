# Formularnachrichten

Wohin die Nachrichten gehen, die Besucher über die Website senden, wie Sie damit arbeiten und wie lange sie aufbewahrt werden.

Wenn jemand auf der Website ein Formular ausfüllt und absendet (etwa das Kontaktformular), passieren zwei Dinge:

1. Die Personen, die dafür eingetragen sind, bekommen eine **E-Mail** mit der Nachricht.
2. Die Nachricht wird in der Verwaltung gespeichert. Dort finden Sie sie auch dann, wenn die E-Mail im Spam gelandet ist.

> Die Namen können bei Ihrer Website anders sein. Die Grundausstattung hat das Formular **Kontaktformular** und die Einstellungen **Formulare**.

## Wer die E-Mails bekommt

1. Öffnen Sie im Bereich **Einstellungen** (oder unter **Inhalte**) den Eintrag **Formulare**.
2. Klicken Sie in der Liste **Neue Nachrichten senden an** auf **Eintrag hinzufügen** und geben Sie eine E-Mail-Adresse ein. Bei mehreren Adressen bekommen alle die Nachricht.
3. Klicken Sie auf **Speichern**.

Die Verwaltung erklärt dazu: *Alle hier erhalten eine E-Mail, wenn jemand ein Formular auf der Website absendet.* Wer die Firma verlässt, muss mit **Entfernen** aus dieser Liste genommen werden. Bleibt die Liste leer, wird die Adresse verwendet, die der Entwickler eingerichtet hat. Besser ist es aber, hier Ihre eigene einzutragen.

> **Tipp:** Lassen Sie die Nachrichten an eine Adresse schicken, die wirklich jemand liest. Am besten an ein gemeinsames Postfach, nicht an die persönliche E-Mail-Adresse einer einzelnen Person.

## Wer die Nachrichten sieht

Die Nachrichten enthalten Namen, E-Mail-Adressen und Texte der Menschen, die Ihnen geschrieben haben: Das sind persönliche Daten. Deshalb sehen sie in der Verwaltung nur **Administratoren und Redakteure**. Ein **Autor** hat das Formular gar nicht im Menü, und wenn er die Adresse kennt, zeigt ihm die Verwaltung, dass ihm die Berechtigung fehlt. Dasselbe gilt für die Liste der Empfänger in den Einstellungen **Formulare**. Es gilt auch für **CSV exportieren** und die Suche.

Muss auch ein Autor die Nachrichten sehen (etwa jemand, der die Community betreut), kann der Entwickler das für ein einzelnes Formular erlauben. Fragen Sie ihn. Wer allgemein was darf, steht im Kapitel [Anmeldung und Ihr Konto](anmeldung-und-konto.md).

## Wo Sie die Nachrichten finden

Öffnen Sie **Kontaktformular** (im Menü im Bereich **Inhalte**). In der Liste stehen alle Nachrichten. Bei jeder sehen Sie Namen, E-Mail-Adresse, den Anfang des Textes und den **Status**:

| Status | Bedeutung |
|---|---|
| **Neu** | Noch niemand hat sich darum gekümmert. |
| **Gelesen** | Jemand hat sie gelesen. |
| **Erledigt** | Sie ist beantwortet oder erledigt. |

**Wer sie sieht.** Formularnachrichten sind persönliche Daten von Besuchern, deshalb sehen sie nur **Redakteure und Administratoren**. Ein Autor hat sie nicht im Menü und kann sie weder öffnen noch herunterladen. Muss jemand anderes sie sehen, ändert ein Administrator unter **Einstellungen → Team** seine Rolle.

Eine Nachricht öffnen Sie mit einem Klick. Den Status ändern Sie im Feld **Status** auf der rechten Seite und speichern dann. So können Sie gemeinsam abstimmen, wer worauf geantwortet hat, und nichts Neues geht unter. Die Nachrichten lassen sich filtern (**Filter**) und durchsuchen (**Suchen…**), sodass Sie zum Beispiel alle mit **Neu** finden.

Eine Nachricht **können Sie nicht selbst anlegen** (die Schaltfläche **+** zum Hinzufügen gibt es hier nicht): Nachrichten kommen nur über die Website.

> **Achtung:** Sie antworten auf eine Nachricht mit einer normalen E-Mail aus Ihrem eigenen Postfach an die Adresse des Absenders. Die Verwaltung selbst schreibt keine E-Mails.

<!-- screenshot: die Liste der Nachrichten aus dem Kontaktformular mit der Spalte Status und den Werten Neu / Gelesen / Erledigt -->

## Export als Tabelle

Sie möchten die Nachrichten in Excel haben? Klicken Sie in der Liste auf **CSV exportieren**. Es wird eine Tabelle mit allen Nachrichten heruntergeladen (die Verwaltung erklärt das mit dem Satz *Alles als Tabelle (CSV) für Excel oder Google Tabellen herunterladen*).

> **Achtung:** Die Datei enthält Namen und E-Mail-Adressen von Menschen. Das sind persönliche Daten. Speichern Sie sie nur dort, wo sie hingehört, und leiten Sie sie nicht weiter. Löschen Sie sie nach der Verwendung. Den Export sehen nur Administratoren und Redakteure.

## Automatisches Löschen

Die Nachrichten enthalten persönliche Daten und sollen deshalb nicht ewig aufbewahrt werden. Der Entwickler kann einstellen, dass sie nach einer bestimmten Zeit von selbst gelöscht werden. Dann sehen Sie unter der Liste einen Satz wie **Nachrichten werden 180 Tage nach Eingang automatisch gelöscht.** Gezählt wird ab dem Tag, an dem die Nachricht eingegangen ist. Eine gelöschte Nachricht verschwindet samt ihren gespeicherten Versionen und lässt sich nicht zurückholen.

Sehen Sie keinen solchen Satz, werden die Nachrichten nicht von selbst gelöscht und bleiben, bis Sie sie entfernen. Nach welcher Zeit sie gelöscht werden sollen, entscheidet Ihre Firma (und es hängt davon ab, was Sie in Ihrer Datenschutzerklärung zusagen). Fragen Sie den Entwickler, der das einstellen kann.

Eine Nachricht können Sie auch selbst löschen: Öffnen Sie sie und klicken Sie unter **Weitere Aktionen** auf **Löschen…**.

## Spam

Vor unerwünschten Nachrichten von Bots müssen Sie keine Angst haben. Das Formular auf der Website wehrt sich auf mehrere Arten, die Sie nicht sehen: mit einem versteckten Feld, das ein Mensch nicht ausfüllt, ein Bot aber schon, mit einer Prüfung, dass das Formular nicht unsinnig schnell abgesendet wurde, mit einer Begrenzung, wie oft ein Besucher senden kann, und gegebenenfalls mit einer „Sind Sie ein Mensch?“-Prüfung von Cloudflare. Bekommen Sie trotzdem Spam, schreiben Sie dem Entwickler.

Eine normale Nachricht von einem Menschen landet nur selten im Spam-Ordner. Warten Sie trotzdem auf eine Nachricht und sie ist nicht gekommen, sehen Sie in der Liste der Nachrichten in der Verwaltung nach. Dort ist sie immer.

## Siehe auch

- [Datenschutz](datenschutz.md): was mit den Daten einer bestimmten Person zu tun ist
- [Anmeldung und Ihr Konto](anmeldung-und-konto.md): wer was darf
- [Wenn etwas nicht klappt](wenn-etwas-nicht-klappt.md)
