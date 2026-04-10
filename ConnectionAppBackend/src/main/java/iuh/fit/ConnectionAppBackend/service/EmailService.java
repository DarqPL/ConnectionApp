package iuh.fit.ConnectionAppBackend.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendOtpEmail(String toEmail, String otp) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Connection App - Mã xác nhận OTP");
        message.setText(
            "Xin chào,\n\n" +
            "Đây là mã xác nhận OTP cho yêu cầu của bạn tại Connection App.\n\n" +
            "Mã OTP của bạn là: " + otp + "\n\n" +
            "Mã này sẽ hết hạn sau 1 phút.\n\n" +
            "Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.\n\n" +
            "Trân trọng,\nĐội ngũ Connection App"
        );
        mailSender.send(message);
    }
}
