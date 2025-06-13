# Vocal Mirror
## A simple web tool for vocal practice.

Created by Danver Braganza
Coded with Sculptor by Imbue

Vocal Mirror is a simple tool intended for vocal practice and giving rapid
feedback on speech. It is a Single Page Web Application which requests
permissions to record the user. It is constantly recording audio from the user
to a buffer, configured for a maximum of 5 minutes.

When the buffer is full, or when it detects a silence from the user of over a
given threshold, it will play all the audio back to the user, starting from the beginning.

During this time, if the user interrupts the audio, it will drop back into recording mode.
