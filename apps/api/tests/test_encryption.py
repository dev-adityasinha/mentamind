"""Unit tests for application-layer AES-256-GCM encryption."""

import base64
import uuid

import pytest
from cryptography.exceptions import InvalidTag

from app.services.encryption import decrypt, encrypt


class TestEncryptDecrypt:
    def test_round_trip_without_aad(self):
        plaintext = "Feeling scattered today, hard to focus."
        ciphertext = encrypt(plaintext)
        assert decrypt(ciphertext) == plaintext

    def test_round_trip_with_aad(self):
        user_id = uuid.uuid4()
        aad = str(user_id).encode()
        plaintext = "Good morning routine, feeling grounded."
        ciphertext = encrypt(plaintext, associated_data=aad)
        assert decrypt(ciphertext, associated_data=aad) == plaintext

    def test_ciphertext_is_not_plaintext(self):
        plaintext = "some sensitive context"
        ciphertext = encrypt(plaintext)
        assert plaintext not in ciphertext
        assert plaintext.encode() not in base64.b64decode(ciphertext)

    def test_each_call_produces_unique_ciphertext(self):
        plaintext = "same input"
        c1 = encrypt(plaintext)
        c2 = encrypt(plaintext)
        assert c1 != c2, "Nonces must be unique per encryption call"

    def test_tampered_ciphertext_raises(self):
        plaintext = "tamper test"
        raw = base64.b64decode(encrypt(plaintext))
        tampered = bytearray(raw)
        tampered[-1] ^= 0xFF
        with pytest.raises(InvalidTag):
            decrypt(base64.b64encode(bytes(tampered)).decode())

    def test_wrong_aad_raises(self):
        user_a = uuid.uuid4()
        user_b = uuid.uuid4()
        plaintext = "bound to user A"
        ciphertext = encrypt(plaintext, associated_data=str(user_a).encode())
        with pytest.raises(InvalidTag):
            decrypt(ciphertext, associated_data=str(user_b).encode())

    def test_missing_aad_raises_when_aad_was_used(self):
        user_id = uuid.uuid4()
        plaintext = "must provide aad"
        ciphertext = encrypt(plaintext, associated_data=str(user_id).encode())
        with pytest.raises(InvalidTag):
            decrypt(ciphertext, associated_data=None)

    def test_unicode_round_trip(self):
        plaintext = "Heute fuhle ich mich gut. من خوب هستم."
        assert decrypt(encrypt(plaintext)) == plaintext

    def test_empty_string_round_trip(self):
        assert decrypt(encrypt("")) == ""
