import os
import qrcode
from PIL import Image
from flask import current_app

class QRService:
    """
    Asset QR Code Generation and Management Service.
    Generates high-resolution, scannable QR codes for community assets.
    """

    @classmethod
    def generate_asset_qr(cls, asset_code, base_url=""):
        """
        Generates and saves a QR code for an asset.
        The QR code payload contains the direct URL or asset URI:
        e.g., http://localhost:5000/assets/AST-ELEV-01
        """
        qr_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'qr_codes')
        os.makedirs(qr_dir, exist_ok=True)

        filename = f"{asset_code}.png"
        file_path = os.path.join(qr_dir, filename)

        # Target endpoint URL
        if base_url:
            data = f"{base_url.rstrip('/')}/assets/{asset_code}"
        else:
            data = f"/assets/{asset_code}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#1e293b", back_color="#ffffff")
        img.save(file_path)

        # Return relative URL for templates and static serving
        return f"uploads/qr_codes/{filename}"
