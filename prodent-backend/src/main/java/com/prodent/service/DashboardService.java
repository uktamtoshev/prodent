package com.prodent.service;

import com.prodent.dto.response.DashboardStatsResponse;
import com.prodent.entity.Appointment;
import com.prodent.repository.AppointmentRepository;
import com.prodent.repository.ClinicRepository;
import com.prodent.repository.DoctorRepository;
import com.prodent.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final AppointmentRepository appointmentRepository;
    private final ClinicRepository clinicRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public DashboardStatsResponse getClinicDashboard(UUID clinicId) {
        long totalAppointments = appointmentRepository.findByClinicId(clinicId, PageRequest.of(0, 1)).getTotalElements();
        long pending = appointmentRepository.countByClinicIdAndStatus(clinicId, Appointment.AppointmentStatus.PENDING);

        LocalDate today = LocalDate.now();
        long completedToday = appointmentRepository.findByClinicIdAndAppointmentDate(clinicId, today).stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.COMPLETED)
                .count();

        BigDecimal revenue = appointmentRepository.findByClinicIdAndAppointmentDate(clinicId, today).stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.COMPLETED && a.getTotalPrice() != null)
                .map(Appointment::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Total unique patients at this clinic
        long totalPatients = appointmentRepository.findByClinicId(clinicId, PageRequest.of(0, Integer.MAX_VALUE))
                .map(Appointment::getPatientId)
                .stream().distinct().count();

        return new DashboardStatsResponse(totalPatients, totalAppointments, completedToday, revenue, pending);
    }

    @Transactional(readOnly = true)
    public DashboardStatsResponse getDoctorDashboard(UUID doctorId) {
        long totalAppointments = appointmentRepository.findByDoctorId(doctorId, PageRequest.of(0, 1)).getTotalElements();

        LocalDate today = LocalDate.now();
        var todayAppointments = appointmentRepository.findByDoctorIdAndAppointmentDateAndStatus(
                doctorId, today, Appointment.AppointmentStatus.COMPLETED);

        long completedToday = todayAppointments.size();

        BigDecimal revenue = todayAppointments.stream()
                .filter(a -> a.getTotalPrice() != null)
                .map(Appointment::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long totalPatients = appointmentRepository.findByDoctorId(doctorId, PageRequest.of(0, Integer.MAX_VALUE))
                .map(Appointment::getPatientId)
                .stream().distinct().count();

        long pending = 0; // Simplified for doctor dashboard

        return new DashboardStatsResponse(totalPatients, totalAppointments, completedToday, revenue, pending);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAdminDashboard() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("totalClinics", clinicRepository.count());
        stats.put("totalDoctors", doctorRepository.count());
        stats.put("clinicsByCountry", clinicRepository.countByCountry());
        return stats;
    }
}
