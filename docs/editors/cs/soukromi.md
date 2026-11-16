# Soukromí

Co dělat, když se vás někdo zeptá, jaké údaje o něm máte, nebo chce, abyste je smazali. Část **Soukromí** vidí jen administrátoři.

Lidé mají právo vědět, co o nich firma ukládá, a dostat to ve čitelné podobě, případně to nechat smazat. Správa k tomu má nástroj, který najde všechno, co je uložené k jedné e-mailové adrese. Není to právní poradenství. Ptejte se i svého pověřence nebo právníka, jak máte na žádosti odpovídat a do kdy.

## Kde to je

V menu vlevo v části **Nastavení** klikněte na **Soukromí**. Pokud ji nevidíte, nejste administrátor. Požádejte kolegu, který administrátor je. Když to zkusíte jinak, napíše se **Tuto stránku mohou používat jen správci.**

## Co všechno se tu najde

Správa hledá podle e-mailové adresy. Prohledá tři místa:

- **Zprávy z formulářů**: zprávy, které z této adresy přišly přes web (např. kontaktní formulář).
- **Účet v administraci**: pokud má člověk u vás účet (je to kolega nebo kolegyně).
- **Záznam aktivity**: záznamy, které tento účet vytvořil, záznamy o něm (pozvánka, změna role) a neúspěšná přihlášení s touto adresou.

Ostatní texty, které někdo napsal do obsahu webu, hledání neprohledává.

## Co je uloženo k adrese

1. Otevřete **Soukromí**.
2. Napište celou **E-mailovou adresu** (`jmeno@example.com`). Když není úplná, napíše se **Zadejte celou e-mailovou adresu.**
3. Klikněte na **Hledat**.

Ukáže se **Uloženo k adrese …** a pod tím tři části s tím, co se našlo. U části, ve které nic není, vidíte věty jako **Z této adresy nepřišla žádná zpráva.**, **Žádný účet s touto adresou.** nebo **Žádné záznamy k této adrese.** Když není nic nikde, uvidíte **K této adrese není nic uloženo.**

<!-- screenshot: stránka Soukromí s nalezenými zprávami, účtem a záznamy aktivity a tlačítky Exportovat do JSON a Smazat data této osoby -->

## Předání údajů osobě

Když člověk žádá o kopii svých údajů:

1. Vyhledejte jeho adresu (viz výše).
2. Klikněte na **Exportovat do JSON**. Stáhne se soubor s tím, co o člověku máte. Hesla v něm nejsou. Potvrdí to **Soubor je stažený**.
3. Soubor předejte osobě bezpečným způsobem (například přes zabezpečenou zprávu, ne jako běžnou přílohu), a ověřte si, že žádá opravdu ona.

## Smazání údajů osoby

1. Vyhledejte e-mailovou adresu.
2. Klikněte na **Smazat data této osoby**.
3. Správa se zeptá **Smazat vše, co je uložené k adrese …?** a vypíše, co přesně se stane, jen z toho, co existuje:
   - **zprávy z formulářů se smažou i s uloženými verzemi**,
   - **účet** s touto adresou se zablokuje a anonymizuje: zmizí jméno a e-mail, ale to, co v administraci udělal, zůstane pod označením „smazaný účet“,
   - v **záznamu aktivity** zmizí jméno, e-mail a IP adresa.
4. Přečtěte si to a potvrďte. Správa vždycky zdůrazní: **Nejde to vrátit zpět.**
5. Až bude hotovo, uvidíte **Smazáno. K adrese … už není nic uloženo.**

> **Pozor:** Smazání se nedá vrátit, ani ze správy, ani z historie. Před potvrzením si adresu dvakrát zkontrolujte. Nejdřív doporučujeme udělat **Exportovat do JSON** a soubor si zatím uložit na bezpečné místo, než ověříte, že jde opravdu o toho správného člověka.

> **Pozor:** Nemůžete smazat **svůj vlastní účet**, ani posledního aktivního administrátora. Chcete-li přestat používat správu vy, požádejte jiného administrátora.

## Co smazání nezmění

Správa o tom otevřeně říká: **Nahrané soubory a texty, které někdo napsal do obsahu, jsou obsah webu a zůstávají. Zálohy se nemění.** Praktický význam:

- Fotka, kterou člověk nahrál, a texty, které napsal do stránek nebo aktualit, zůstávají. Když je potřeba smazat i je, udělejte to ručně (viz [Obrázky a soubory](obrazky-a-soubory.md) a [Stránky a bloky](stranky-a-bloky.md)).
- **Zálohy** firmy a vývojáře obsahují údaje, které existovaly v době zálohy. Ty se mažou postupně, jak se zálohy obměňují. V odpovědi člověku to můžete uvést (a zeptejte se vývojáře, jak dlouho se zálohy drží).
- E-mail s kopií zprávy, který přišel ve vaší poště, se tím nesmaže. Smažte ho sami.

## Zprávy se mažou samy

Kromě ručního mazání se zprávy z formulářů na některých webech samy po čase smažou. Viz [Zprávy z formulářů](zpravy-z-formularu.md). Záznam o dění ve správě (kdo se kdy přihlásil a co dělal) se maže po roce, pokud nemá vývojář nastaveno jinak.

## Viz také

- [Zprávy z formulářů](zpravy-z-formularu.md)
- [Přihlášení a váš účet](prihlaseni-a-ucet.md): role a pozvání
- [Co dělat, když něco nefunguje](kdyz-neco-nefunguje.md)
