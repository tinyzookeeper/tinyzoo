# Zprávy z formulářů

Kam chodí zprávy, které návštěvníci pošlou z webu, jak s nimi pracovat a jak dlouho se uchovávají.

Když někdo na webu vyplní a odešle formulář (třeba kontaktní), stane se dvě věci:

1. Lidem, kteří jsou k tomu nastavení, přijde **e-mail** se zprávou.
2. Zpráva se uloží do správy. Tam ji najdete, i kdyby e-mail zapadl do spamu.

> Názvy se u vašeho webu mohou lišit. Základní web má formulář **Kontaktní formulář** a nastavení **Formuláře**.

## Komu chodí e-maily

1. V části **Nastavení** (nebo v **Obsahu**) otevřete **Formuláře**.
2. V seznamu **Nové zprávy posílat na** klikněte na **Přidat položku** a napište e-mail. Je-li adres víc, přijde zpráva všem.
3. Klikněte na **Uložit**.

Správa k tomu říká: *Všem zde přijde e-mail, když někdo odešle formulář na webu.* Kdo odejde z firmy, toho je třeba z tohoto seznamu odebrat tlačítkem **Odebrat**. Pokud seznam zůstane prázdný, použije se adresa, kterou nastavil vývojář. Dobré je ale mít tu svou vyplněnou.

> **Tip:** Posílejte zprávy na adresu, kterou někdo opravdu čte. Nejlépe sdílenou schránku, ne osobní e-mail jednoho člověka.

## Kdo zprávy vidí

Zprávy obsahují jména, e-maily a texty lidí, kteří vám psali: jsou to osobní údaje. Proto je ve správě vidí jen **administrátoři a editoři**. **Autor** formulář v menu vůbec nemá a když zná jeho adresu, správa mu ukáže, že na to nemá oprávnění. Totéž platí pro seznam příjemců v nastavení **Formuláře**. Platí to i pro **Export CSV** a vyhledávání.

Potřebuje-li zprávy vidět i autor (třeba správce komunity), vývojář to může u jednoho formuláře povolit. Zeptejte se ho. Kdo smí co obecně, je v kapitole [Přihlášení a váš účet](prihlaseni-a-ucet.md).

## Kde zprávy najdete

Otevřete **Kontaktní formulář** (v menu v části **Obsah**). V seznamu jsou všechny zprávy. U každé vidíte jméno, e-mail, začátek textu a **Stav**:

| Stav | Význam |
|---|---|
| **Nové** | Ještě se jí nikdo nevěnoval. |
| **Přečtené** | Někdo ji přečetl. |
| **Vyřízené** | Je odpovězeno nebo vyřešeno. |

**Kdo je vidí.** Zprávy z formulářů jsou osobní údaje návštěvníků, proto je vidí jen **editoři a administrátoři**. Autor je v menu nemá a nemůže je otevřít ani stáhnout. Potřebuje-li je vidět někdo další, změní mu roli administrátor v **Nastavení → Tým**.

Zprávu otevřete kliknutím. Stav změníte v poli **Stav** na pravé straně a uložíte. Společně se tak můžete domluvit, kdo na co odpověděl, a nové věci nezapadnou. Zprávy se dají filtrovat (**Filtr**) i prohledávat (**Hledat…**), takže najdete třeba všechna **Nové**.

Zprávu **nemůžete vytvořit sami** (tlačítko **+** pro přidání tu není): zprávy přicházejí jen z webu.

> **Pozor:** Odpovídáte na zprávu normálním e-mailem ze své pošty na adresu odesílatele. Správa sama e-maily nepíše.

<!-- screenshot: seznam zpráv z kontaktního formuláře se sloupcem Stav a hodnotami Nové / Přečtené / Vyřízené -->

## Export do tabulky

Chcete zprávy mít v Excelu? V seznamu klikněte na **Export CSV**. Stáhne se tabulka se všemi zprávami (správa to vysvětluje větou *Stáhnout vše jako tabulku (CSV) pro Excel nebo Tabulky Google*).

> **Pozor:** Soubor obsahuje jména a e-maily lidí. Je to osobní údaj. Uložte ho jen tam, kam patří, a nerozesílejte ho dál. Po použití ho smažte. Export vidí jen administrátoři a editoři.

## Automatické mazání

Zprávy obsahují osobní údaje, proto se nemají uchovávat věčně. Vývojář může nastavit, že se po určité době samy smažou. Pak pod seznamem uvidíte větu jako **Zprávy se automaticky mažou 180 dní po přijetí.** Počítá se od dne, kdy zpráva přišla. Smazaná zpráva zmizí i s uloženými verzemi a nejde ji vrátit.

Pokud takovou větu nevidíte, zprávy se nemažou samy a zůstávají, dokud je neodstraníte. Za jak dlouho se mají mazat, je rozhodnutí vaší firmy (a závisí na tom, co slibujete v zásadách ochrany osobních údajů). Zeptejte se vývojáře, který to může nastavit.

Zprávu můžete smazat i sami: otevřete ji a v **Další akce** klikněte na **Smazat…**.

## Spam

Nechtěných zpráv od robotů se není třeba bát. Formulář na webu se jim brání několika způsoby, které vy nevidíte: skrytým polem, které člověk nevyplní, ale robot ano, kontrolou, že formulář nebyl odeslán nesmyslně rychle, omezením počtu odeslání od jednoho návštěvníka a případně kontrolou „nejste robot“ od Cloudflare. Pokud přesto spam dostáváte, napište vývojáři.

Normální zpráva od člověka mezi nevyžádané e-maily patří výjimečně. Když přesto čekáte zprávu a nepřišla, podívejte se do seznamu zpráv ve správě. Je tam vždycky.

## Viz také

- [Soukromí](soukromi.md): co s údaji o konkrétní osobě
- [Přihlášení a váš účet](prihlaseni-a-ucet.md): kdo smí co
- [Co dělat, když něco nefunguje](kdyz-neco-nefunguje.md)
