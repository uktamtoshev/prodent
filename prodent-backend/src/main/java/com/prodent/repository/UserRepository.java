package com.prodent.repository;

import com.prodent.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);

    Optional<User> findByEmailOrPhone(String email, String phone);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    Optional<User> findByReferralCode(String referralCode);

    boolean existsByReferralCode(String referralCode);

    @Query("SELECT u FROM User u WHERE LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<User> searchByName(@Param("query") String query, Pageable pageable);

    /** Users registered between from and to, with email, not unsubscribed — for drip campaigns */
    @Query("SELECT u FROM User u WHERE u.createdAt BETWEEN :from AND :to " +
           "AND u.email IS NOT NULL AND u.emailUnsubscribed = false")
    List<User> findNewUsersWithEmail(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);
}
