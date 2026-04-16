package com.prodent.repository;

import com.prodent.entity.VirtualAccountTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface VirtualAccountTransactionRepository extends JpaRepository<VirtualAccountTransaction, UUID> {

    Page<VirtualAccountTransaction> findByAccountIdOrderByCreatedAtDesc(UUID accountId, Pageable pageable);
}
