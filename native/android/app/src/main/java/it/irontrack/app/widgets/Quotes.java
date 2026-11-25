package it.irontrack.app.widgets;

/**
 * Frasi di atleti per il widget motivazionale. Solo citazioni con una fonte rintracciabile
 * (indicata accanto); quelle nate in inglese sono tradotte da noi.
 * Prima di aggiungerne una, verificare la fonte: molte frasi famose sono attribuite male.
 */
final class Quotes {
    private Quotes() {}

    static final String[][] LIST = {
        // Newsweek, 25 settembre 1978 ("Suffer now, and live the rest of your life as a champion")
        { "Soffri adesso e vivi il resto della tua vita da campione.", "Muhammad Ali" },
        // The Greatest: My Own Story, 1975
        { "I campioni non si costruiscono in palestra. Si costruiscono con qualcosa che hanno dentro: un desiderio, un sogno, una visione.", "Muhammad Ali" },
        // Arnold Schwarzenegger: A Portrait, 1990
        { "Sono le ultime tre o quattro ripetizioni a far crescere il muscolo.", "Arnold Schwarzenegger" },
        // Pumping Iron, 1977
        { "Questa zona di dolore separa il campione da chi campione non è.", "Arnold Schwarzenegger" },
        // spot Nike «Failure», 1997
        { "Ho fallito più e più volte nella mia vita. Ed è per questo che ho successo.", "Michael Jordan" },
        // spot Nike «Failure», 1997
        { "Ho sbagliato più di 9.000 tiri in carriera. Ho perso quasi 300 partite.", "Michael Jordan" },
        // I Can't Accept Not Trying, 1994
        { "Posso accettare il fallimento, tutti falliscono in qualcosa. Ma non posso accettare di non provarci.", "Michael Jordan" },
        // I Can't Accept Not Trying, 1994
        { "Impara bene i fondamentali e il livello di tutto quello che fai salirà.", "Michael Jordan" },
        // la Repubblica, intervista di Emanuela Audisio, 3 giugno 2012
        { "La fatica non è mai sprecata. Soffri, ma sogni.", "Pietro Mennea" },
        // la Repubblica, 3 giugno 2012
        { "Io allenavo la fatica con l'allenamento.", "Pietro Mennea" },
        // la Repubblica, 21 marzo 2013
        { "I risultati si ottengono solo con molto lavoro.", "Pietro Mennea" },
        // la Repubblica, 21 marzo 2013
        { "Per la vittoria non basta il talento, ci vuole il lavoro e il sacrificio quotidiano.", "Pietro Mennea" },
        // citato in U. Scanagatta, 50 anni di Credito Sportivo
        { "Sono un uomo che non si sente mai arrivato, sono sempre pronto a ripartire dai blocchi.", "Pietro Mennea" },
        // The Hockey News, 1983
        { "Sbagli il 100% dei tiri che non fai.", "Wayne Gretzky" },
        // INEOS 1:59 Challenge, Vienna, 12 ottobre 2019
        { "Nessun essere umano ha limiti.", "Eliud Kipchoge" },
        // titolo del suo libro, Rizzoli 2017
        { "Se sembra impossibile, allora si può fare.", "Bebe Vio" },
        // video Ronnie Coleman: The Unbelievable, 2000
        { "Tutti vogliono diventare bodybuilder, ma nessuno vuole sollevare pesi pesanti.", "Ronnie Coleman" },
        // il suo grido nei video di allenamento
        { "Yeah buddy! Light weight, baby!", "Ronnie Coleman" }
    };
}
