package br.com.radarms.mocklocation

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity: Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val t = TextView(this)
        t.textSize = 18f
        t.setPadding(40,80,40,40)
        t.text = "PokeMS Location\n\n1. Ative Opções do desenvolvedor.\n2. Escolha este app em 'Selecionar app de local fictício'.\n3. Mantenha o aparelho conectado por ADB.\n\nO scanner enviará coordenadas por broadcast."
        setContentView(t)
    }
}
